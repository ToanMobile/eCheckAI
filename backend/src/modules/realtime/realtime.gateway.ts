import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.config';
import { JwtPayload } from '../../config/jwt.config';
import { AttendanceRecord, AttendanceStatus } from '../attendance/attendance.entity';
import { FraudLog } from '../fraud/fraud-log.entity';

const GLOBAL_ROOM = 'global';
const SUPER_ADMIN = 'super_admin';
const HR = 'hr';

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3001'],
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // Dedicated Redis subscriber — must NOT share the main client
  private subscriber!: Redis;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    @InjectRepository(FraudLog)
    private readonly fraudLogRepository: Repository<FraudLog>,
  ) {}

  afterInit(): void {
    this.logger.log('[RealtimeGateway] Initialized');
    this.subscriber = this.redis.duplicate();
    void this.subscriber.subscribe('attendance:checkin', 'attendance:checkout', 'fraud:detected');
    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message) as Record<string, unknown>;
        if (channel === 'attendance:checkin') {
          const branchId = data['branchId'] as string;
          this.server.to(`branch:${branchId}`).to(GLOBAL_ROOM).emit('attendance:checkin', data);
        } else if (channel === 'attendance:checkout') {
          const branchId = data['branchId'] as string;
          this.server.to(`branch:${branchId}`).to(GLOBAL_ROOM).emit('attendance:checkout', data);
        } else if (channel === 'fraud:detected') {
          const branchId = data['branchId'] as string;
          this.server.to(`branch:${branchId}`).to(GLOBAL_ROOM).emit('fraud:detected', data);
        }
      } catch (err) {
        this.logger.error('[RealtimeGateway] Redis message parse error', err);
      }
    });
  }

  handleConnection(client: Socket): void {
    try {
      const token =
        (client.handshake.auth as Record<string, unknown>)?.['token'] as string
        ?? (client.handshake.headers['authorization'] as string | undefined)?.replace('Bearer ', '');

      if (!token) {
        throw new WsException('No token provided');
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data['user'] = payload;

      // Auto-join rooms based on role
      void client.join(`employee:${payload.sub}`);
      if (payload.branchId) {
        void client.join(`branch:${payload.branchId}`);
      }
      if (payload.role === SUPER_ADMIN || payload.role === HR) {
        void client.join(GLOBAL_ROOM);
      }

      this.logger.log(
        `[RealtimeGateway] ${client.id} connected (role=${payload.role}, branch=${payload.branchId ?? 'none'})`,
      );
    } catch (err) {
      this.logger.warn(`[RealtimeGateway] Rejected connection ${client.id}: ${String(err)}`);
      client.emit('exception', { status: 'unauthorized', message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`[RealtimeGateway] Client disconnected: ${client.id}`);
  }

  // ── Client → Server ───────────────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(client: Socket): void {
    client.emit('pong');
  }

  @SubscribeMessage('subscribe:branch')
  handleSubscribeBranch(
    client: Socket,
    payload: { branch_id: string },
  ): void {
    if (!payload?.branch_id) return;
    void client.join(`branch:${payload.branch_id}`);
    this.logger.log(`[RealtimeGateway] ${client.id} subscribed to branch:${payload.branch_id}`);
  }

  @SubscribeMessage('unsubscribe:branch')
  handleUnsubscribeBranch(
    client: Socket,
    payload: { branch_id: string },
  ): void {
    if (!payload?.branch_id) return;
    void client.leave(`branch:${payload.branch_id}`);
  }

  @SubscribeMessage('join_branch')
  handleJoinBranch(client: Socket, branchId: string): void {
    void client.join(`branch:${branchId}`);
  }

  @SubscribeMessage('leave_branch')
  handleLeaveBranch(client: Socket, branchId: string): void {
    void client.leave(`branch:${branchId}`);
  }

  // ── Programmatic emitters (called by services) ────────────────────────────

  emitCheckin(branchId: string, data: Record<string, unknown>): void {
    this.server.to(`branch:${branchId}`).to(GLOBAL_ROOM).emit('attendance:checkin', data);
  }

  emitCheckout(branchId: string, data: Record<string, unknown>): void {
    this.server.to(`branch:${branchId}`).to(GLOBAL_ROOM).emit('attendance:checkout', data);
  }

  emitFraud(branchId: string, data: Record<string, unknown>): void {
    this.server.to(`branch:${branchId}`).to(GLOBAL_ROOM).emit('fraud:detected', data);
  }

  emitSystemNotification(data: Record<string, unknown>): void {
    this.server.to(GLOBAL_ROOM).emit('system:notification', data);
  }

  // ── 30-second stats broadcast ─────────────────────────────────────────────

  @Cron('*/30 * * * * *')
  async broadcastStats(): Promise<void> {
    try {
      const today = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date());

      const [totalCheckins, onTime, late, absent, active, fraudToday] =
        await Promise.all([
          this.attendanceRepository.count({ where: { workDate: today } }),
          this.attendanceRepository.count({
            where: { workDate: today, status: AttendanceStatus.ON_TIME },
          }),
          this.attendanceRepository.count({
            where: { workDate: today, status: AttendanceStatus.LATE },
          }),
          this.attendanceRepository.count({
            where: { workDate: today, status: AttendanceStatus.ABSENT },
          }),
          this.attendanceRepository
            .createQueryBuilder('ar')
            .where('ar.work_date = :today', { today })
            .andWhere('ar.check_out IS NULL')
            .getCount(),
          this.fraudLogRepository
            .createQueryBuilder('fl')
            .where('DATE(fl.created_at AT TIME ZONE \'Asia/Ho_Chi_Minh\') = :today', { today })
            .getCount(),
        ]);

      this.server.to(GLOBAL_ROOM).emit('stats:update', {
        timestamp: new Date().toISOString(),
        total_checkins_today: totalCheckins,
        total_on_time_today: onTime,
        total_late_today: late,
        total_absent_today: absent,
        active_employees_now: active,
        fraud_alerts_today: fraudToday,
      });
    } catch (err) {
      this.logger.error('[RealtimeGateway] broadcastStats error', err);
    }
  }
}

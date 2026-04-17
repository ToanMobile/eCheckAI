import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { WorkSchedule } from './schedule.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { REDIS_CLIENT, RedisKeys, RedisTTL } from '../../config/redis.config';

export interface ScheduleItem {
  id: string;
  branchId: string;
  branchName: string;
  shiftName: string;
  checkinTime: string;
  checkoutTime: string;
  windowMinutes: number;
  activeDays: number[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedSchedules {
  items: ScheduleItem[];
  total: number;
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(WorkSchedule)
    private readonly scheduleRepository: Repository<WorkSchedule>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Get all schedules with branch name (for admin/HR portal listing) */
  async findAll(limit = 200, page = 1, branchId?: string): Promise<PaginatedSchedules> {
    const skip = (page - 1) * limit;
    const manager = this.scheduleRepository.manager;

    // Keep branchId as $1 for COUNT, append limit/skip as $2/$3 for SELECT
    const baseParams: unknown[] = branchId ? [branchId] : [];
    const branchFilter = branchId ? `AND s.branch_id = $1` : '';
    const countFilter = branchId ? `WHERE branch_id = $1` : '';

    const [rows, totalRows] = await Promise.all([
      manager.query<Array<Record<string, unknown>>>(
        `SELECT
           s.id,
           s.branch_id          AS "branchId",
           b.name               AS "branchName",
           s.name               AS "shiftName",
           s.checkin_time::text AS "checkinTime",
           s.checkout_time::text AS "checkoutTime",
           s.window_minutes     AS "windowMinutes",
           s.active_days        AS "activeDays",
           s.is_active          AS "isActive",
           s.created_at         AS "createdAt",
           s.updated_at         AS "updatedAt"
         FROM schedules s
         LEFT JOIN branches b ON b.id = s.branch_id
         WHERE 1=1 ${branchFilter}
         ORDER BY s.checkin_time ASC
         LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
        [...baseParams, limit, skip],
      ),
      manager.query<Array<{ count: string }>>(
        `SELECT COUNT(*) AS count FROM schedules ${countFilter}`,
        baseParams,
      ),
    ]);

    return { items: rows as unknown as ScheduleItem[], total: parseInt(totalRows[0]?.count ?? '0', 10) };
  }

  /**
   * Get all schedules for a branch (Redis-cached)
   */
  async findByBranch(branchId: string): Promise<WorkSchedule[]> {
    const cacheKey = RedisKeys.schedule(branchId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as WorkSchedule[];
    }

    const schedules = await this.scheduleRepository.find({
      where: { branchId },
      order: { checkinTime: 'ASC' },
    });

    await this.redis.setex(
      cacheKey,
      RedisTTL.SCHEDULE,
      JSON.stringify(schedules),
    );

    return schedules;
  }

  /**
   * Get active schedule for a branch (for employee endpoint)
   */
  async findMySchedule(branchId: string): Promise<WorkSchedule[]> {
    const all = await this.findByBranch(branchId);
    return all.filter((s) => s.isActive);
  }

  async create(dto: CreateScheduleDto): Promise<WorkSchedule> {
    const schedule = this.scheduleRepository.create({
      branchId: dto.branch_id,
      shiftName: dto.shift_name ?? 'Ca làm việc',
      checkinTime: dto.checkin_time,
      checkoutTime: dto.checkout_time,
      windowMinutes: dto.window_minutes ?? 15,
      activeDays: dto.active_days ?? [1, 2, 3, 4, 5],
      isActive: dto.is_active ?? true,
    });

    const saved = await this.scheduleRepository.save(schedule);

    // Invalidate branch schedule cache
    await this.redis.del(RedisKeys.schedule(dto.branch_id));

    return saved;
  }

  async update(id: string, dto: UpdateScheduleDto): Promise<WorkSchedule> {
    const schedule = await this.scheduleRepository.findOne({ where: { id } });
    if (!schedule) {
      throw new NotFoundException('SCHEDULE_NOT_FOUND');
    }

    await this.scheduleRepository.update(id, {
      ...(dto.shift_name !== undefined && { shiftName: dto.shift_name }),
      ...(dto.checkin_time !== undefined && { checkinTime: dto.checkin_time }),
      ...(dto.checkout_time !== undefined && { checkoutTime: dto.checkout_time }),
      ...(dto.window_minutes !== undefined && { windowMinutes: dto.window_minutes }),
      ...(dto.active_days !== undefined && { activeDays: dto.active_days }),
      ...(dto.is_active !== undefined && { isActive: dto.is_active }),
    });

    // Invalidate cache
    await this.redis.del(RedisKeys.schedule(schedule.branchId));

    const updated = await this.scheduleRepository.findOne({ where: { id } });
    if (!updated) {
      throw new NotFoundException('SCHEDULE_NOT_FOUND');
    }
    return updated;
  }

  /**
   * Get the active schedule for a branch — returns first active schedule
   * Used by attendance validation
   */
  async findActiveForBranch(branchId: string): Promise<WorkSchedule | null> {
    const schedules = await this.findMySchedule(branchId);
    return schedules[0] ?? null;
  }

  async findById(id: string): Promise<WorkSchedule> {
    const schedule = await this.scheduleRepository.findOne({ where: { id } });
    if (!schedule) {
      throw new NotFoundException('SCHEDULE_NOT_FOUND');
    }
    return schedule;
  }
}

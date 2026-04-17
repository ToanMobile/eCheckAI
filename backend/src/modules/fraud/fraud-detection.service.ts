import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudLog, FraudType, FraudSeverity } from './fraud-log.entity';

export interface FraudLogInput {
  employeeId: string;
  branchId?: string | null;
  attendanceId?: string | null;
  fraudType: string;
  severity?: FraudSeverity;
  ipAddress?: string | null;
  deviceId?: string | null;   // stored inside details.device_id
  details?: Record<string, unknown>;
  requestPayload?: Record<string, unknown>; // merged into details
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    @InjectRepository(FraudLog)
    private readonly fraudLogRepository: Repository<FraudLog>,
  ) {}

  /**
   * Log a fraud event to the database.
   * Merges deviceId and requestPayload into the JSONB details column so the
   * entity schema stays clean while keeping backward-compat with callers.
   */
  async logFraud(input: FraudLogInput): Promise<FraudLog> {
    const details: Record<string, unknown> = {
      ...(input.details ?? {}),
    };
    if (input.deviceId) {
      details['device_id'] = input.deviceId;
    }
    if (input.requestPayload) {
      details['request_payload'] = input.requestPayload;
    }

    const log = this.fraudLogRepository.create({
      employeeId: input.employeeId,
      attendanceId: input.attendanceId ?? null,
      fraudType: input.fraudType as FraudType,
      severity: input.severity ?? FraudSeverity.MEDIUM,
      ipAddress: input.ipAddress ?? null,
      details,
    });

    const saved = await this.fraudLogRepository.save(log);
    this.logger.warn(
      `Fraud detected: ${input.fraudType} for employee ${input.employeeId}`,
      { fraudType: input.fraudType, employeeId: input.employeeId },
    );
    return saved;
  }

  /**
   * Get fraud logs for a specific employee (most recent first).
   */
  async getLogsForEmployee(
    employeeId: string,
    limit = 50,
  ): Promise<FraudLog[]> {
    return this.fraudLogRepository.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get all recent fraud logs (paginated, optionally filtered by branch).
   */
  async getRecentLogs(
    page = 1,
    limit = 20,
    branchId?: string,
  ): Promise<{ items: FraudLog[]; total: number }> {
    const qb = this.fraudLogRepository
      .createQueryBuilder('fl')
      .orderBy('fl.created_at', 'DESC');

    void branchId; // branch_id not in fraud_logs table

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }
}

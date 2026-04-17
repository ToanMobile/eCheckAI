import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FraudLog, FraudSeverity, FraudType } from './fraud-log.entity';

export interface FraudLogInput {
  employeeId: string;
  branchId?: string | null;
  attendanceId?: string | null;
  fraudType: FraudType;
  severity?: FraudSeverity;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export interface FraudLogQueryDto {
  branchId?: string;
  severity?: FraudSeverity;
  fraudType?: FraudType;
  resolved?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedFraudLogs {
  items: FraudLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class FraudLogService {
  private readonly logger = new Logger(FraudLogService.name);

  constructor(
    @InjectRepository(FraudLog)
    private readonly fraudLogRepository: Repository<FraudLog>,
  ) {}

  /**
   * Create a new fraud log entry.
   */
  async logFraud(input: FraudLogInput): Promise<FraudLog> {
    const log = this.fraudLogRepository.create({
      employeeId: input.employeeId,
      branchId: input.branchId ?? null,
      attendanceId: input.attendanceId ?? null,
      fraudType: input.fraudType,
      severity: input.severity ?? FraudSeverity.MEDIUM,
      details: input.details ?? {},
      ipAddress: input.ipAddress ?? null,
    });

    const saved = await this.fraudLogRepository.save(log);
    this.logger.warn(
      `Fraud logged: ${input.fraudType} [${saved.severity}] for employee ${input.employeeId}`,
    );
    return saved;
  }

  /**
   * Get paginated fraud logs with optional filters.
   */
  async getAll(query: FraudLogQueryDto): Promise<PaginatedFraudLogs> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const qb: SelectQueryBuilder<FraudLog> = this.fraudLogRepository
      .createQueryBuilder('fl')
      .orderBy('fl.created_at', 'DESC');

    if (query.branchId) {
      qb.andWhere('fl.branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.severity) {
      qb.andWhere('fl.severity = :severity', { severity: query.severity });
    }

    if (query.fraudType) {
      qb.andWhere('fl.fraud_type = :fraudType', { fraudType: query.fraudType });
    }

    if (query.resolved === true) {
      qb.andWhere('fl.resolved_at IS NOT NULL');
    } else if (query.resolved === false) {
      qb.andWhere('fl.resolved_at IS NULL');
    }

    if (query.dateFrom) {
      qb.andWhere('fl.created_at >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('fl.created_at <= :dateTo', {
        dateTo: new Date(query.dateTo + 'T23:59:59Z'),
      });
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single fraud log by ID. Throws NotFoundException if not found.
   */
  async getOne(id: string): Promise<FraudLog> {
    const log = await this.fraudLogRepository.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`FraudLog ${id} not found`);
    }
    return log;
  }

  /**
   * Mark a fraud log as resolved.
   */
  async resolve(
    id: string,
    resolvedBy: string,
    resolutionNote: string,
  ): Promise<FraudLog> {
    const log = await this.getOne(id);

    log.resolvedAt = new Date();
    log.resolvedBy = resolvedBy;
    log.resolutionNote = resolutionNote;

    const saved = await this.fraudLogRepository.save(log);
    this.logger.log(`FraudLog ${id} resolved by ${resolvedBy}`);
    return saved;
  }
}

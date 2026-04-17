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
  attendanceId?: string | null;
  fraudType: FraudType;
  severity?: FraudSeverity;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export interface FraudLogQueryDto {
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
   * Get paginated fraud logs with optional filters — joins employees for display fields.
   */
  async getAll(query: FraudLogQueryDto): Promise<PaginatedFraudLogs> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (query.severity) {
      params.push(query.severity);
      conditions.push(`fl.severity = $${params.length}`);
    }
    if (query.fraudType) {
      params.push(query.fraudType);
      conditions.push(`fl.fraud_type = $${params.length}`);
    }
    if (query.resolved === true) {
      conditions.push('fl.resolved_at IS NOT NULL');
    } else if (query.resolved === false) {
      conditions.push('fl.resolved_at IS NULL');
    }
    if (query.dateFrom) {
      params.push(new Date(query.dateFrom));
      conditions.push(`fl.created_at >= $${params.length}`);
    }
    if (query.dateTo) {
      params.push(new Date(query.dateTo + 'T23:59:59Z'));
      conditions.push(`fl.created_at <= $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countParams = [...params];
    const countSql = `SELECT COUNT(*) AS total FROM fraud_logs fl ${where}`;
    const totalResult = await this.fraudLogRepository.query(countSql, countParams) as Array<{ total: string }>;
    const total = parseInt(totalResult[0].total, 10);

    params.push(limit);
    params.push(skip);
    const dataSql = `
      SELECT
        fl.id, fl.employee_id, fl.fraud_type AS type, fl.severity,
        fl.details, fl.ip_address, fl.resolved_at, fl.resolved_by,
        fl.resolution_note, fl.created_at, fl.updated_at,
        e.employee_code, e.full_name,
        b.id   AS branch_id,
        b.name AS branch_name
      FROM fraud_logs fl
      LEFT JOIN employees e ON e.id = fl.employee_id
      LEFT JOIN branches  b ON b.id = e.branch_id
      ${where}
      ORDER BY fl.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const rows = await this.fraudLogRepository.query(dataSql, params) as Record<string, unknown>[];

    const items = rows.map(r => ({
      ...r,
      is_resolved: r['resolved_at'] != null,
    })) as unknown as FraudLog[];

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
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

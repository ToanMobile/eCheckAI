import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import {
  AttendanceRecord,
  AttendanceStatus,
  CheckType,
} from './attendance.entity';
import { AutoCheckinDto } from './dto/auto-checkin.dto';
import { ManualCheckinDto } from './dto/manual-checkin.dto';
import { SelfManualCheckinDto } from './dto/self-manual-checkin.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { BranchService } from '../branch/branch.service';
import { EmployeeService } from '../employee/employee.service';
import { ScheduleService } from '../schedule/schedule.service';
import { FraudDetectionService } from '../fraud/fraud-detection.service';
import { validateWifiBssid } from './validators/wifi-validator';
import { validateGeoFence } from './validators/geo-validator';
import {
  validateScheduleWindow,
  ScheduleCheckResult,
} from './validators/schedule-validator';
import { toVietnamDate } from '../../common/utils/time-window';
import { REDIS_CLIENT, RedisKeys } from '../../config/redis.config';
import { PaginatedResult } from '../branch/branch.service';

const MAX_CHECKINS_PER_DAY = 2;

export interface AutoCheckinResult {
  status: AttendanceStatus;
  checkInTime: string;
  branchName: string;
  minutesLate: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepository: Repository<AttendanceRecord>,
    private readonly branchService: BranchService,
    private readonly employeeService: EmployeeService,
    private readonly scheduleService: ScheduleService,
    private readonly fraudDetectionService: FraudDetectionService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Full auto check-in flow as specified in CLAUDE.md section 6
   */
  async autoCheckin(
    dto: AutoCheckinDto,
    clientIp: string,
  ): Promise<AutoCheckinResult> {
    // Step 1: Lookup employee with cache
    const employee = await this.employeeService.getRedisCache(dto.employee_id);
    if (!employee || !employee.isActive) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    // Step 2: Lookup branch config
    if (!employee.branchId) {
      throw new BadRequestException('EMPLOYEE_HAS_NO_BRANCH');
    }
    const branchConfig = await this.branchService.getBranchConfig(
      employee.branchId,
    );
    if (!branchConfig.isActive) {
      throw new BadRequestException('BRANCH_INACTIVE');
    }

    // Step 3: Lookup schedule
    const schedule = await this.scheduleService.findActiveForBranch(
      employee.branchId,
    );
    if (!schedule) {
      throw new BadRequestException('NO_ACTIVE_SCHEDULE');
    }

    // Step 4: FRAUD CHECKS
    // 4a. Device ID check
    if (
      employee.registeredDeviceId &&
      employee.registeredDeviceId !== dto.device_id
    ) {
      await this.fraudDetectionService.logFraud({
        employeeId: dto.employee_id,
        branchId: employee.branchId,
        fraudType: 'device_mismatch',
        ipAddress: clientIp,
        deviceId: dto.device_id,
        details: {
          expected: employee.registeredDeviceId,
          received: dto.device_id,
        },
      });
      throw new UnprocessableEntityException('DEVICE_MISMATCH');
    }

    // 4b. VPN check
    if (dto.is_vpn_active) {
      await this.fraudDetectionService.logFraud({
        employeeId: dto.employee_id,
        branchId: employee.branchId,
        fraudType: 'vpn_detected',
        ipAddress: clientIp,
        deviceId: dto.device_id,
        details: { ip: clientIp },
      });
      throw new UnprocessableEntityException('VPN_DETECTED');
    }

    // 4c. Mock location check
    if (dto.is_mock_location) {
      await this.fraudDetectionService.logFraud({
        employeeId: dto.employee_id,
        branchId: employee.branchId,
        fraudType: 'mock_location',
        ipAddress: clientIp,
        deviceId: dto.device_id,
        details: {},
      });
      throw new UnprocessableEntityException('MOCK_LOCATION_DETECTED');
    }

    // 4d. Rate limit: max 2 check-ins per employee per day
    const today = toVietnamDate(dto.timestamp);
    const rateLimitKey = RedisKeys.rateLimitCheckin(dto.employee_id, today);
    const checkinsToday = await this.redis.get(rateLimitKey);
    if (checkinsToday && parseInt(checkinsToday, 10) >= MAX_CHECKINS_PER_DAY) {
      await this.fraudDetectionService.logFraud({
        employeeId: dto.employee_id,
        branchId: employee.branchId,
        fraudType: 'rate_limit_exceeded',
        ipAddress: clientIp,
        deviceId: dto.device_id,
        details: { count: checkinsToday, date: today },
      });
      throw new UnprocessableEntityException('RATE_LIMIT_EXCEEDED');
    }

    // Step 5: CONDITION CHECKS
    // 5a. WiFi BSSID
    const wifiResult = validateWifiBssid(dto.wifi_bssid, branchConfig.wifiBssids);
    if (!wifiResult.passed) {
      throw new UnprocessableEntityException(
        wifiResult.failure ?? 'WIFI_MISMATCH',
      );
    }

    // 5b. GPS geofence
    const geoResult = validateGeoFence(
      dto.latitude,
      dto.longitude,
      dto.gps_accuracy,
      branchConfig.lat,
      branchConfig.lng,
      branchConfig.radius,
    );
    if (!geoResult.passed) {
      throw new UnprocessableEntityException(
        geoResult.failure ?? 'OUTSIDE_GEOFENCE',
      );
    }

    // 5c. Schedule time window
    const scheduleResult = validateScheduleWindow(
      dto.timestamp,
      schedule.checkinTime,
      schedule.windowMinutes,
      schedule.activeDays,
      branchConfig.timezone,
    );
    if (
      scheduleResult.result === ScheduleCheckResult.OUTSIDE_WINDOW ||
      scheduleResult.result === ScheduleCheckResult.WRONG_DAY
    ) {
      throw new UnprocessableEntityException(
        scheduleResult.failure ?? 'OUTSIDE_SCHEDULE_WINDOW',
      );
    }

    // Step 6: Determine attendance status
    const attendanceStatus =
      scheduleResult.result === ScheduleCheckResult.LATE
        ? AttendanceStatus.LATE
        : AttendanceStatus.ON_TIME;

    // Step 7: Insert attendance record
    const record = this.attendanceRepository.create({
      employeeId: dto.employee_id,
      branchId: employee.branchId,
      workDate: today,
      checkIn: new Date(dto.timestamp),
      status: attendanceStatus,
      checkType: CheckType.AUTO_CHECKIN,
      scheduleId: schedule.id,
      locationSnapshot: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.gps_accuracy,
        wifi_bssid: dto.wifi_bssid,
        wifi_ssid: dto.wifi_ssid,
        is_vpn_active: dto.is_vpn_active,
        is_mock_location: dto.is_mock_location,
      },
      deviceSnapshot: {
        device_id: dto.device_id,
        device_model: dto.device_model,
        os_version: dto.os_version,
        app_version: dto.app_version,
      },
    });

    const saved = await this.attendanceRepository.save(record);

    // Step 8: Increment rate limit counter
    await this.redis.multi()
      .incr(rateLimitKey)
      .expire(rateLimitKey, 86400) // expire at end of day (24h safety)
      .exec();

    // Step 9: Publish event for WebSocket + notification
    await this.redis.publish(
      'attendance:checkin',
      JSON.stringify({
        recordId: saved.id,
        employeeId: dto.employee_id,
        branchId: employee.branchId,
        status: attendanceStatus,
        timestamp: dto.timestamp,
      }),
    );

    const branch = await this.branchService.findOne(employee.branchId);

    return {
      status: attendanceStatus,
      checkInTime: saved.checkIn?.toISOString() ?? dto.timestamp,
      branchName: branch.name,
      minutesLate: scheduleResult.minutesLate ?? 0,
    };
  }

  /**
   * Auto check-out flow
   */
  async autoCheckout(
    dto: AutoCheckinDto,
    clientIp: string,
  ): Promise<{ checkOutTime: string; branchName: string }> {
    void clientIp;
    const employee = await this.employeeService.getRedisCache(dto.employee_id);
    if (!employee || !employee.isActive) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    if (!employee.branchId) {
      throw new BadRequestException('EMPLOYEE_HAS_NO_BRANCH');
    }

    const branchConfig = await this.branchService.getBranchConfig(
      employee.branchId,
    );
    const today = toVietnamDate(dto.timestamp);

    // Find today's check-in record
    const existingRecord = await this.attendanceRepository
      .createQueryBuilder('ar')
      .where('ar.employee_id = :employeeId', { employeeId: dto.employee_id })
      .andWhere('ar.work_date = :workDate', { workDate: today })
      .andWhere('ar.check_out IS NULL')
      .getOne();

    if (!existingRecord) {
      throw new BadRequestException('NO_CHECKIN_RECORD_TODAY');
    }

    // Validate fraud signals
    if (dto.is_vpn_active || dto.is_mock_location) {
      throw new UnprocessableEntityException('FRAUD_DETECTED');
    }

    // Validate geofence (relax WiFi check for checkout)
    const geoResult = validateGeoFence(
      dto.latitude,
      dto.longitude,
      dto.gps_accuracy,
      branchConfig.lat,
      branchConfig.lng,
      branchConfig.radius,
    );
    if (!geoResult.passed) {
      throw new UnprocessableEntityException(
        geoResult.failure ?? 'OUTSIDE_GEOFENCE',
      );
    }

    await this.attendanceRepository.update(existingRecord.id, {
      checkOut: new Date(dto.timestamp),
      checkType: CheckType.AUTO_CHECKOUT,
    });

    await this.redis.publish(
      'attendance:checkout',
      JSON.stringify({
        recordId: existingRecord.id,
        employeeId: dto.employee_id,
        branchId: employee.branchId,
        timestamp: dto.timestamp,
      }),
    );

    const branch = await this.branchService.findOne(employee.branchId);
    return {
      checkOutTime: dto.timestamp,
      branchName: branch.name,
    };
  }

  /**
   * Manual check-in (fallback)
   */
  async manualCheckin(
    dto: ManualCheckinDto,
    operatorId: string,
  ): Promise<AttendanceRecord> {
    const employee = await this.employeeService.getRedisCache(dto.employee_id);
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    const today = toVietnamDate(dto.timestamp);

    const record = this.attendanceRepository.create({
      employeeId: dto.employee_id,
      branchId: employee.branchId ?? '',
      workDate: today,
      checkIn: new Date(dto.timestamp),
      status: AttendanceStatus.PENDING,
      checkType: CheckType.MANUAL,
      note: dto.note
        ? `[Manual by ${operatorId}] ${dto.note}`
        : `[Manual by ${operatorId}]`,
      deviceSnapshot: {
        device_id: dto.device_id,
        device_model: 'manual',
        os_version: 'manual',
        app_version: 'manual',
      },
    });

    return this.attendanceRepository.save(record);
  }

  /**
   * Employee self-service makeup attendance submission.
   * Creates a pending record with type=manual that managers can review.
   */
  async selfManualCheckin(
    dto: SelfManualCheckinDto,
    employeeId: string,
  ): Promise<AttendanceRecord> {
    const employee = await this.employeeService.getRedisCache(employeeId);
    if (!employee) throw new NotFoundException('EMPLOYEE_NOT_FOUND');

    // Limit to 7 days back
    const todayVN = toVietnamDate(new Date().toISOString());
    const daysAgo = Math.floor(
      (new Date(todayVN).getTime() - new Date(dto.work_date).getTime()) / 86400000,
    );
    if (daysAgo > 7 || daysAgo < 0) {
      throw new BadRequestException('WORK_DATE_OUT_OF_RANGE');
    }
    if (!dto.check_in && !dto.check_out) {
      throw new BadRequestException('AT_LEAST_ONE_TIME_REQUIRED');
    }

    const record = this.attendanceRepository.create({
      employeeId,
      branchId: employee.branchId ?? '',
      workDate: dto.work_date,
      checkIn: dto.check_in ? new Date(dto.check_in) : undefined,
      checkOut: dto.check_out ? new Date(dto.check_out) : undefined,
      status: AttendanceStatus.PENDING,
      checkType: CheckType.MANUAL,
      note: `[Chấm bù] ${dto.note}`,
      deviceSnapshot: { device_id: 'self-service', device_model: 'mobile', os_version: '', app_version: '' },
    });

    return this.attendanceRepository.save(record);
  }

  // ─── Private query helpers ────────────────────────────────────────────────

  /** Builds a WHERE clause + parameter array from attendance filter fields. */
  private buildWhere(filters: {
    branchId?: string;
    employeeId?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    search?: string;
  }): { where: string; params: unknown[] } {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filters.branchId) {
      params.push(filters.branchId);
      conditions.push(`ar.branch_id = $${params.length}`);
    }
    if (filters.employeeId) {
      params.push(filters.employeeId);
      conditions.push(`ar.employee_id = $${params.length}`);
    }
    if (filters.date_from) {
      params.push(filters.date_from);
      conditions.push(`ar.work_date >= $${params.length}`);
    }
    if (filters.date_to) {
      params.push(filters.date_to);
      conditions.push(`ar.work_date <= $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`ar.status = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(e.full_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length})`);
    }

    return {
      where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
      params,
    };
  }

  /** Runs a paginated attendance SELECT + COUNT in parallel using a pre-built WHERE clause. */
  private async runPaginatedAttendanceSql(
    where: string,
    params: unknown[],
    limit: number,
    skip: number,
  ): Promise<{ rows: Record<string, unknown>[]; total: number }> {
    const rowParams = [...params, limit, skip];
    const [countResult, rows] = await Promise.all([
      this.attendanceRepository.query(
        `SELECT COUNT(*) AS total
         FROM attendance_records ar
         LEFT JOIN employees e ON e.id = ar.employee_id
         ${where}`,
        params,
      ) as Promise<Array<{ total: string }>>,
      this.attendanceRepository.query(
        `SELECT ar.id, ar.employee_id, ar.branch_id, ar.work_date::text AS work_date,
                ar.check_in, ar.check_out, ar.status, ar.type,
                ar.note, ar.created_at, ar.updated_at,
                e.full_name, e.employee_code,
                b.name AS branch_name
         FROM attendance_records ar
         LEFT JOIN employees e ON e.id = ar.employee_id
         LEFT JOIN branches  b ON b.id = ar.branch_id
         ${where}
         ORDER BY ar.work_date DESC, ar.check_in DESC NULLS LAST
         LIMIT $${rowParams.length - 1} OFFSET $${rowParams.length}`,
        rowParams,
      ) as Promise<Record<string, unknown>[]>,
    ]);

    return { rows, total: parseInt((countResult as Array<{ total: string }>)[0]?.total ?? '0', 10) };
  }

  // ─── Public query methods ─────────────────────────────────────────────────

  async findMine(
    employeeId: string,
    query: AttendanceQueryDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.per_page ?? query.limit ?? 20, 200);
    const { where, params } = this.buildWhere({
      employeeId,
      date_from: query.date_from,
      date_to: query.date_to,
      status: query.status,
    });
    const { rows, total } = await this.runPaginatedAttendanceSql(where, params, limit, (page - 1) * limit);
    return { items: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findAll(
    query: AttendanceQueryDto,
    scopedBranchId?: string | null,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.per_page ?? query.limit ?? 50, 200);
    const { where, params } = this.buildWhere({
      branchId: scopedBranchId ?? query.branch_id,
      employeeId: query.employee_id,
      date_from: query.date_from,
      date_to: query.date_to,
      status: query.status,
      search: query.search,
    });
    const { rows, total } = await this.runPaginatedAttendanceSql(where, params, limit, (page - 1) * limit);
    return { items: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findRecent(
    limit = 10,
    branchId?: string,
  ): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [limit];
    const where = branchId ? `WHERE ar.branch_id = $2` : '';
    if (branchId) params.push(branchId);

    return this.attendanceRepository.query(
      `SELECT ar.id, ar.work_date::text AS work_date, ar.check_in, ar.check_out,
              ar.status, ar.type, ar.created_at,
              e.full_name, e.employee_code,
              b.name AS branch_name
       FROM attendance_records ar
       LEFT JOIN employees e ON e.id = ar.employee_id
       LEFT JOIN branches  b ON b.id = ar.branch_id
       ${where}
       ORDER BY ar.created_at DESC
       LIMIT $1`,
      params,
    ) as Promise<Record<string, unknown>[]>;
  }

  /**
   * Export as CSV. Max 31 days per call — returns error string if range exceeded.
   */
  async exportCsv(
    branchId?: string,
    dateFrom?: string,
    dateTo?: string,
    status?: AttendanceStatus,
    scopedBranchId?: string | null,
  ): Promise<string> {
    if (dateFrom && dateTo) {
      const diffDays = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000;
      if (diffDays > 31) {
        return 'error: export range must not exceed 31 days';
      }
    }

    const { where, params } = this.buildWhere({
      branchId: scopedBranchId ?? branchId,
      date_from: dateFrom,
      date_to: dateTo,
      status,
    });

    const records = await this.attendanceRepository.query(
      `SELECT e.employee_code, e.full_name, b.name AS branch_name,
              ar.work_date::text AS work_date, ar.check_in, ar.check_out, ar.status, ar.note
       FROM attendance_records ar
       LEFT JOIN employees e ON e.id = ar.employee_id
       LEFT JOIN branches  b ON b.id = ar.branch_id
       ${where}
       ORDER BY ar.work_date ASC, ar.check_in ASC NULLS LAST`,
      params,
    ) as Array<{
      employee_code: string; full_name: string; branch_name: string;
      work_date: string; check_in: string | null; check_out: string | null;
      status: string; note: string | null;
    }>;

    const escape = (v: string | null | undefined): string =>
      v ? `"${v.replace(/"/g, '""')}"` : '';

    const header =
      'employee_code,full_name,branch_name,work_date,check_in,check_out,status,note';
    const rows = records.map((r) => [
      r.employee_code ?? '',
      escape(r.full_name),
      escape(r.branch_name),
      r.work_date,
      r.check_in ?? '',
      r.check_out ?? '',
      r.status,
      escape(r.note),
    ].join(','));

    return [header, ...rows].join('\n');
  }

  async getStats(
    branchId?: string,
    _dateFrom?: string,
    _dateTo?: string,
  ): Promise<Record<string, unknown>> {
    const todayStr = new Date().toISOString().slice(0, 10);

    const baseQb = () => {
      const qb = this.attendanceRepository.createQueryBuilder('ar');
      if (branchId) qb.where('ar.branch_id = :branchId', { branchId });
      return qb;
    };

    // Today stats
    const todayQb = baseQb().andWhere('ar.work_date = :today', { today: todayStr });
    const [totalToday, onTimeToday, lateToday, absentToday, totalEmployees] = await Promise.all([
      todayQb.getCount(),
      todayQb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.ON_TIME }).getCount(),
      todayQb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.LATE }).getCount(),
      todayQb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.ABSENT }).getCount(),
      this.employeeService.countActive(),
    ]);

    // 7-day trend — all days fetched in parallel
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        dateStr: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      };
    });

    const trend = await Promise.all(
      days.map(async ({ dateStr, label }) => {
        const dayQb = baseQb().andWhere('ar.work_date = :d', { d: dateStr });
        const [t, ot, lt, ab] = await Promise.all([
          dayQb.getCount(),
          dayQb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.ON_TIME }).getCount(),
          dayQb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.LATE }).getCount(),
          dayQb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.ABSENT }).getCount(),
        ]);
        return { date: label, on_time: ot, late: lt, absent: ab, total: t };
      }),
    );

    return {
      today: {
        date: todayStr,
        total_employees: totalEmployees,
        total_checked_in: totalToday,
        on_time: onTimeToday,
        late: lateToday,
        absent: absentToday,
        check_in_rate: totalEmployees > 0 ? Math.round((totalToday / totalEmployees) * 100) : 0,
      },
      trend,
    };
  }
}

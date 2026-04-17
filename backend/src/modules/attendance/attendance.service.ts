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
      minutesLate: scheduleResult.minutesLate,
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
      minutesLate: scheduleResult.minutesLate,
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
      status: AttendanceStatus.MANUAL,
      checkType: CheckType.MANUAL_CHECKIN,
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

  async findAll(
    query: AttendanceQueryDto,
    scopedBranchId?: string | null,
  ): Promise<PaginatedResult<AttendanceRecord>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.attendanceRepository
      .createQueryBuilder('ar')
      .leftJoinAndSelect('ar.employee', 'employee')
      .leftJoinAndSelect('ar.branch', 'branch');

    if (scopedBranchId) {
      qb.where('ar.branch_id = :branchId', { branchId: scopedBranchId });
    } else if (query.branch_id) {
      qb.where('ar.branch_id = :branchId', { branchId: query.branch_id });
    }

    if (query.employee_id) {
      qb.andWhere('ar.employee_id = :employeeId', {
        employeeId: query.employee_id,
      });
    }

    if (query.date_from) {
      qb.andWhere('ar.work_date >= :dateFrom', { dateFrom: query.date_from });
    }

    if (query.date_to) {
      qb.andWhere('ar.work_date <= :dateTo', { dateTo: query.date_to });
    }

    if (query.status) {
      qb.andWhere('ar.status = :status', { status: query.status });
    }

    const [items, total] = await qb
      .orderBy('ar.work_date', 'DESC')
      .addOrderBy('ar.check_in', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Export attendance records as CSV string.
   * Max 31 days per export per CLAUDE.md spec.
   */
  async exportCsv(
    branchId?: string,
    dateFrom?: string,
    dateTo?: string,
    status?: AttendanceStatus,
    scopedBranchId?: string | null,
  ): Promise<string> {
    const qb = this.attendanceRepository
      .createQueryBuilder('ar')
      .leftJoinAndSelect('ar.employee', 'employee')
      .leftJoinAndSelect('ar.branch', 'branch')
      .orderBy('ar.work_date', 'ASC')
      .addOrderBy('ar.check_in', 'ASC');

    const effectiveBranchId = scopedBranchId ?? branchId;
    if (effectiveBranchId) {
      qb.where('ar.branch_id = :branchId', { branchId: effectiveBranchId });
    }
    if (dateFrom) qb.andWhere('ar.work_date >= :dateFrom', { dateFrom });
    if (dateTo)   qb.andWhere('ar.work_date <= :dateTo',   { dateTo });
    if (status)   qb.andWhere('ar.status = :status',       { status });

    const records = await qb.getMany();

    const escape = (v: string | null | undefined): string =>
      v ? `"${v.replace(/"/g, '""')}"` : '';

    const header =
      'employee_code,full_name,branch_name,work_date,check_in,check_out,status,note';
    const rows = records.map((r) => {
      const cols = [
        r.employee?.employeeCode ?? '',
        escape(r.employee?.fullName),
        escape(r.branch?.name),
        r.workDate,
        r.checkIn ? r.checkIn.toISOString() : '',
        r.checkOut ? r.checkOut.toISOString() : '',
        r.status,
        escape(r.note),
      ];
      return cols.join(',');
    });

    return [header, ...rows].join('\n');
  }

  async getStats(
    branchId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, unknown>> {
    const qb = this.attendanceRepository.createQueryBuilder('ar');

    if (branchId) {
      qb.where('ar.branch_id = :branchId', { branchId });
    }
    if (dateFrom) {
      qb.andWhere('ar.work_date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('ar.work_date <= :dateTo', { dateTo });
    }

    const [total, onTime, late, absent] = await Promise.all([
      qb.getCount(),
      qb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.ON_TIME }).getCount(),
      qb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.LATE }).getCount(),
      qb.clone().andWhere('ar.status = :s', { s: AttendanceStatus.ABSENT }).getCount(),
    ]);

    return {
      total,
      on_time: onTime,
      late,
      absent,
      on_time_rate: total > 0 ? ((onTime / total) * 100).toFixed(1) : '0.0',
    };
  }
}

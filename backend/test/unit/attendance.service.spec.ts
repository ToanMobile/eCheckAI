/**
 * Attendance Service unit tests
 * Test IDs: ATT-CI-001 to ATT-CI-011
 *
 * Strategy: Mock all external dependencies (repos, Redis, downstream services)
 * and exercise the validation logic inside autoCheckin().
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import {
  AttendanceRecord,
  AttendanceStatus,
} from '../../src/modules/attendance/attendance.entity';
import { BranchService } from '../../src/modules/branch/branch.service';
import { EmployeeService } from '../../src/modules/employee/employee.service';
import { ScheduleService } from '../../src/modules/schedule/schedule.service';
import { FraudDetectionService } from '../../src/modules/fraud/fraud-detection.service';
import { REDIS_CLIENT } from '../../src/config/redis.config';
import { Employee, EmployeeRole } from '../../src/modules/employee/employee.entity';

// u2500u2500 fixtures u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

// Monday 2026-04-13 08:00 Vietnam = 2026-04-13T01:00:00Z (exactly at schedule → on_time)
const TIMESTAMP_ON_TIME = '2026-04-13T01:00:00Z';
// Monday 2026-04-13 08:10 VN (10 min late, within 15 min window)
const TIMESTAMP_LATE_10 = '2026-04-13T01:10:00Z';
// Monday 2026-04-13 08:25 VN (outside 15 min window)
const TIMESTAMP_OUTSIDE_WINDOW = '2026-04-13T01:25:00Z';

const BRANCH_ID = 'branch-uuid-1';
const EMPLOYEE_ID = 'emp-uuid-1';
const DEVICE_ID = 'device-abc';
const BRANCH_LAT = 10.7769;
const BRANCH_LNG = 106.7009;
const BRANCH_RADIUS = 200;
const BRANCH_WIFI = ['AA:BB:CC:DD:EE:FF'];

function makeBranchConfig() {
  return {
    id: BRANCH_ID,
    name: 'HDBankQ1',
    lat: BRANCH_LAT,
    lng: BRANCH_LNG,
    radius: BRANCH_RADIUS,
    wifiBssids: BRANCH_WIFI,
    timezone: 'Asia/Ho_Chi_Minh',
    isActive: true,
  };
}

function makeSchedule() {
  return {
    id: 'sch-uuid-1',
    checkinTime: '08:00',
    checkoutTime: '17:30',
    windowMinutes: 15,
    activeDays: [1, 2, 3, 4, 5],
  };
}

function makeEmployee(overrides: Partial<Employee> = {}): Partial<Employee> {
  return {
    id: EMPLOYEE_ID,
    email: 'emp@hd.com',
    fullName: 'Nguyen Van A',
    employeeCode: 'EMP001',
    role: EmployeeRole.EMPLOYEE,
    branchId: BRANCH_ID,
    registeredDeviceId: DEVICE_ID,
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

function makeCheckinDto(overrides: Record<string, unknown> = {}) {
  return {
    employee_id: EMPLOYEE_ID,
    wifi_bssid: 'AA:BB:CC:DD:EE:FF',
    wifi_ssid: 'HDBank_Q1',
    latitude: BRANCH_LAT,
    longitude: BRANCH_LNG,
    gps_accuracy: 10,
    device_id: DEVICE_ID,
    device_model: 'Samsung S24',
    os_version: 'Android 14',
    app_version: '1.0.0',
    timestamp: TIMESTAMP_ON_TIME,
    is_vpn_active: false,
    is_mock_location: false,
    ...overrides,
  };
}

// u2500u2500 test suite u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

describe('AttendanceService.autoCheckin', () => {
  let service: AttendanceService;

  const mockAttendanceRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => ({ ...entity, id: 'att-uuid-1', checkIn: new Date(TIMESTAMP_ON_TIME) })),
    createQueryBuilder: jest.fn(),
  };

  const mockEmployeeService = {
    getRedisCache: jest.fn(),
  };

  const mockBranchService = {
    getBranchConfig: jest.fn(),
    findOne: jest.fn().mockResolvedValue({ name: 'HDBankQ1' }),
  };

  const mockScheduleService = {
    findActiveForBranch: jest.fn(),
  };

  const mockFraudDetectionService = {
    logFraud: jest.fn().mockResolvedValue({}),
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    multi: jest.fn().mockReturnValue({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    publish: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset to valid state by default
    mockEmployeeService.getRedisCache.mockResolvedValue(makeEmployee());
    mockBranchService.getBranchConfig.mockResolvedValue(makeBranchConfig());
    mockScheduleService.findActiveForBranch.mockResolvedValue(makeSchedule());
    mockRedis.get.mockResolvedValue(null); // no rate limit hit

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(AttendanceRecord), useValue: mockAttendanceRepo },
        { provide: BranchService, useValue: mockBranchService },
        { provide: EmployeeService, useValue: mockEmployeeService },
        { provide: ScheduleService, useValue: mockScheduleService },
        { provide: FraudDetectionService, useValue: mockFraudDetectionService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  // ATT-CI-001
  it('should_return_on_time_when_valid_wifi_gps_and_within_window', async () => {
    const result = await service.autoCheckin(makeCheckinDto(), '1.2.3.4');
    expect(result.status).toBe(AttendanceStatus.ON_TIME);
    expect(result.branchName).toBe('HDBankQ1');
  });

  // ATT-CI-002
  it('should_return_late_when_within_window_but_after_checkin_time', async () => {
    const result = await service.autoCheckin(
      makeCheckinDto({ timestamp: TIMESTAMP_LATE_10 }),
      '1.2.3.4',
    );
    expect(result.status).toBe(AttendanceStatus.LATE);
    expect(result.minutesLate).toBeGreaterThan(0);
  });

  // ATT-CI-003
  it('should_throw_when_outside_time_window', async () => {
    await expect(
      service.autoCheckin(
        makeCheckinDto({ timestamp: TIMESTAMP_OUTSIDE_WINDOW }),
        '1.2.3.4',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // ATT-CI-004
  it('should_throw_when_wifi_bssid_mismatch', async () => {
    await expect(
      service.autoCheckin(
        makeCheckinDto({ wifi_bssid: '00:11:22:33:44:55' }),
        '1.2.3.4',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // ATT-CI-005
  it('should_throw_when_gps_outside_geofence', async () => {
    // Move 5km away
    await expect(
      service.autoCheckin(
        makeCheckinDto({ latitude: 10.82, longitude: 106.7009 }),
        '1.2.3.4',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // ATT-CI-006
  it('should_throw_when_gps_accuracy_too_low', async () => {
    await expect(
      service.autoCheckin(
        makeCheckinDto({ gps_accuracy: 100 }), // > 50m threshold
        '1.2.3.4',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // ATT-CI-007
  it('should_throw_when_vpn_active', async () => {
    await expect(
      service.autoCheckin(
        makeCheckinDto({ is_vpn_active: true }),
        '1.2.3.4',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockFraudDetectionService.logFraud).toHaveBeenCalledWith(
      expect.objectContaining({ fraudType: 'vpn_detected' }),
    );
  });

  // ATT-CI-008
  it('should_throw_when_mock_location_detected', async () => {
    await expect(
      service.autoCheckin(
        makeCheckinDto({ is_mock_location: true }),
        '1.2.3.4',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockFraudDetectionService.logFraud).toHaveBeenCalledWith(
      expect.objectContaining({ fraudType: 'mock_location' }),
    );
  });

  // ATT-CI-009
  it('should_throw_when_device_id_mismatch', async () => {
    mockEmployeeService.getRedisCache.mockResolvedValue(
      makeEmployee({ registeredDeviceId: 'registered-device' }),
    );

    await expect(
      service.autoCheckin(
        makeCheckinDto({ device_id: 'different-device' }),
        '1.2.3.4',
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockFraudDetectionService.logFraud).toHaveBeenCalledWith(
      expect.objectContaining({ fraudType: 'device_mismatch' }),
    );
  });

  // ATT-CI-011
  it('should_throw_when_checkin_rate_limit_exceeded', async () => {
    mockRedis.get.mockResolvedValue('2'); // already 2 checkins today

    await expect(
      service.autoCheckin(makeCheckinDto(), '1.2.3.4'),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockFraudDetectionService.logFraud).toHaveBeenCalledWith(
      expect.objectContaining({ fraudType: 'rate_limit_exceeded' }),
    );
  });

  it('should_throw_not_found_when_employee_not_found', async () => {
    mockEmployeeService.getRedisCache.mockResolvedValue(null);

    await expect(
      service.autoCheckin(makeCheckinDto(), '1.2.3.4'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should_throw_bad_request_when_employee_has_no_branch', async () => {
    mockEmployeeService.getRedisCache.mockResolvedValue(
      makeEmployee({ branchId: null }),
    );

    await expect(
      service.autoCheckin(makeCheckinDto(), '1.2.3.4'),
    ).rejects.toThrow(BadRequestException);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/modules/auth/auth.service';
import { Employee, EmployeeRole } from '../../src/modules/employee/employee.entity';
import { REDIS_CLIENT, RedisKeys } from '../../src/config/redis.config';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-uuid-1',
    employeeCode: 'EMP001',
    fullName: 'Nguyen Van A',
    email: 'a@hd.com',
    passwordHash: '$2b$12$saltsaltsaltsaltsaltsahashed', // placeholder
    phoneNumber: null,
    role: EmployeeRole.EMPLOYEE,
    branchId: 'branch-uuid-1',
    branch: Promise.resolve(null),
    attendanceRecords: Promise.resolve([]),
    registeredDeviceId: null,
    isActive: true,
    lastLoginAt: null,
    otpCode: null,
    otpExpiresAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    ...overrides,
  } as Employee;
}

// ── test suite ────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  const mockEmployeeRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    publish: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, def?: string) => def ?? 'test-secret'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Employee), useValue: mockEmployeeRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should_return_token_pair_when_credentials_valid', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const employee = makeEmployee({ passwordHash: hash });
      mockEmployeeRepo.findOne.mockResolvedValue(employee);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const result = await service.login(
        { email: 'a@hd.com', password: 'password123', device_id: 'dev-001', device_model: 'Pixel 8' },
        '127.0.0.1',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.employee.email).toBe('a@hd.com');
    });

    it('should_throw_unauthorized_when_employee_not_found', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login(
          { email: 'unknown@hd.com', password: 'any', device_id: 'dev-001', device_model: 'Pixel 8' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should_throw_unauthorized_when_password_wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockEmployeeRepo.findOne.mockResolvedValue(makeEmployee({ passwordHash: hash }));

      await expect(
        service.login(
          { email: 'a@hd.com', password: 'wrong', device_id: 'dev-001', device_model: 'Pixel 8' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should_throw_unauthorized_when_account_disabled', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockEmployeeRepo.findOne.mockResolvedValue(
        makeEmployee({ passwordHash: hash, isActive: false }),
      );

      await expect(
        service.login(
          { email: 'a@hd.com', password: 'password123', device_id: 'dev-001', device_model: 'Pixel 8' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should_throw_unauthorized_when_device_mismatch', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockEmployeeRepo.findOne.mockResolvedValue(
        makeEmployee({ passwordHash: hash, registeredDeviceId: 'dev-registered' }),
      );

      await expect(
        service.login(
          { email: 'a@hd.com', password: 'password123', device_id: 'dev-different', device_model: 'Pixel 8' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refresh ──────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should_return_new_token_pair_when_refresh_token_valid', async () => {
      const payload = {
        sub: 'emp-uuid-1',
        email: 'a@hd.com',
        role: EmployeeRole.EMPLOYEE,
        branchId: 'branch-uuid-1',
        deviceId: 'dev-001',
        jti: 'jti-abc',
      };
      mockJwtService.verify.mockReturnValue(payload);

      const storedHash = await bcrypt.hash('old-refresh-token', 10);
      mockRedis.get.mockResolvedValue(storedHash);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.setex.mockResolvedValue('OK');

      const employee = makeEmployee();
      mockEmployeeRepo.findOne.mockResolvedValue(employee);

      const result = await service.refresh({ refresh_token: 'old-refresh-token' });
      expect(result).toHaveProperty('accessToken');
    });

    it('should_throw_when_refresh_token_signature_invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(
        service.refresh({ refresh_token: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should_throw_when_refresh_token_not_in_redis', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'emp-uuid-1',
        jti: 'jti-abc',
        deviceId: 'dev-001',
      });
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.refresh({ refresh_token: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── registerDevice ───────────────────────────────────────────────────────

  describe('registerDevice', () => {
    it('should_register_device_when_none_registered', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(makeEmployee({ registeredDeviceId: null }));
      mockRedis.del.mockResolvedValue(1);

      const result = await service.registerDevice('emp-uuid-1', {
        device_id: 'new-device', device_model: 'Pixel 8', os_version: 'Android 14',
      });
      expect(result.deviceId).toBe('new-device');
      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        'emp-uuid-1',
        { registeredDeviceId: 'new-device' },
      );
    });

    it('should_throw_conflict_when_device_already_registered', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(
        makeEmployee({ registeredDeviceId: 'already-registered' }),
      );

      await expect(
        service.registerDevice('emp-uuid-1', { device_id: 'new-device', device_model: 'Pixel 8', os_version: 'Android 14' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── resetDevice ──────────────────────────────────────────────────────────

  describe('resetDevice', () => {
    it('should_clear_registered_device_id_when_reset', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(
        makeEmployee({ registeredDeviceId: 'old-device' }),
      );
      mockRedis.del.mockResolvedValue(1);

      await service.resetDevice('emp-uuid-1');

      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        'emp-uuid-1',
        { registeredDeviceId: null },
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        RedisKeys.employee('emp-uuid-1'),
      );
    });

    it('should_throw_not_found_when_employee_does_not_exist', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(null);

      await expect(service.resetDevice('ghost-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── forgotPassword ───────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should_generate_otp_and_store_in_redis_when_email_found', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(makeEmployee());
      mockRedis.setex.mockResolvedValue('OK');

      await service.forgotPassword({ email: 'a@hd.com' });

      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        'emp-uuid-1',
        expect.objectContaining({ otpCode: expect.any(String) }),
      );
    });

    it('should_return_silently_when_email_not_found', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(null);

      await expect(service.forgotPassword({ email: 'ghost@hd.com' })).resolves.toBeUndefined();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  // ── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should_update_password_hash_when_otp_valid', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.del.mockResolvedValue(1);
      mockEmployeeRepo.findOne.mockResolvedValue(makeEmployee());

      await service.resetPassword({
        email: 'a@hd.com',
        otp: '123456',
        new_password: 'NewPassword1!',
      });

      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        'emp-uuid-1',
        expect.objectContaining({
          passwordHash: expect.any(String),
          otpCode: null,
          otpExpiresAt: null,
        }),
      );
    });

    it('should_throw_bad_request_when_otp_wrong', async () => {
      mockRedis.get.mockResolvedValue('123456');

      await expect(
        service.resetPassword({
          email: 'a@hd.com',
          otp: '999999',
          new_password: 'NewPassword1!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should_throw_bad_request_when_otp_expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          email: 'a@hd.com',
          otp: '123456',
          new_password: 'NewPassword1!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── changePassword ───────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should_update_password_when_current_password_correct', async () => {
      const hash = await bcrypt.hash('OldPass1!', 10);
      mockEmployeeRepo.findOne.mockResolvedValue(makeEmployee({ passwordHash: hash }));
      mockRedis.del.mockResolvedValue(1);

      await service.changePassword('emp-uuid-1', {
        current_password: 'OldPass1!',
        new_password: 'NewPass2!',
      });

      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        'emp-uuid-1',
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
    });

    it('should_throw_bad_request_when_current_password_wrong', async () => {
      const hash = await bcrypt.hash('Correct1!', 10);
      mockEmployeeRepo.findOne.mockResolvedValue(makeEmployee({ passwordHash: hash }));

      await expect(
        service.changePassword('emp-uuid-1', {
          current_password: 'Wrong1!',
          new_password: 'NewPass2!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

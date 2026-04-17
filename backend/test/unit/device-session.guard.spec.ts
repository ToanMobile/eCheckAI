import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DeviceSessionGuard } from '../../src/common/guards/device-session.guard';
import { REDIS_CLIENT } from '../../src/config/redis.config';

function makeContext(
  user?: { sub?: string; deviceId?: string },
  cachedEmployee?: object | null,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('DeviceSessionGuard', () => {
  let guard: DeviceSessionGuard;

  const mockRedis = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceSessionGuard,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    guard = module.get<DeviceSessionGuard>(DeviceSessionGuard);
  });

  // DEV-SESS-002
  it('should_throw_401_when_jwt_deviceId_does_not_match_registered_device', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({ registeredDeviceId: 'device-registered' }),
    );

    const ctx = makeContext({ sub: 'emp-uuid-1', deviceId: 'device-different' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should_allow_when_jwt_deviceId_matches_registered_device', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({ registeredDeviceId: 'device-abc' }),
    );

    const ctx = makeContext({ sub: 'emp-uuid-1', deviceId: 'device-abc' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should_allow_when_no_redis_cache_exists_for_employee', async () => {
    mockRedis.get.mockResolvedValue(null);

    const ctx = makeContext({ sub: 'emp-uuid-1', deviceId: 'any-device' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should_allow_when_employee_has_no_registered_device_in_cache', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({ registeredDeviceId: null }),
    );

    const ctx = makeContext({ sub: 'emp-uuid-1', deviceId: 'any-device' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // DEV-SESS-001 — guard rejects requests with missing user info
  it('should_throw_401_when_user_is_missing_from_request', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should_throw_401_when_deviceId_missing_from_jwt', async () => {
    const ctx = makeContext({ sub: 'emp-uuid-1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should_throw_401_when_sub_missing_from_jwt', async () => {
    const ctx = makeContext({ deviceId: 'dev-001' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});

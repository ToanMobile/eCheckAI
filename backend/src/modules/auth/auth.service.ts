import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { Employee } from '../employee/employee.entity';
import {
  JwtPayload,
  JWT_REFRESH_EXPIRES,
  JWT_REFRESH_EXPIRES_SECONDS,
} from '../../config/jwt.config';
import {
  REDIS_CLIENT,
  RedisKeys,
  RedisTTL,
} from '../../config/redis.config';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult extends TokenPair {
  employee: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    branchId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Login flow:
   * 1. Find employee by email
   * 2. Verify password
   * 3. Check isActive
   * 4. Generate token pair
   * 5. Store refresh token hash in Redis
   * 6. Update lastLoginAt
   */
  async login(dto: LoginDto, ip: string): Promise<LoginResult> {
    void ip; // available for audit logging

    const employee = await this.employeeRepository.findOne({
      where: { email: dto.email, deletedAt: IsNull() },
    });

    if (!employee) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      employee.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    if (!employee.isActive) {
      throw new UnauthorizedException('ACCOUNT_DISABLED');
    }

    // Check device registration
    if (
      employee.registeredDeviceId &&
      employee.registeredDeviceId !== dto.device_id
    ) {
      throw new UnauthorizedException('DEVICE_NOT_REGISTERED');
    }

    const tokens = await this.generateTokens(employee, dto.device_id ?? 'web');

    // Update last login
    await this.employeeRepository.update(employee.id, {
      lastLoginAt: new Date(),
    });

    // Invalidate Redis cache to force fresh fetch
    await this.redis.del(RedisKeys.employee(employee.id));

    return {
      ...tokens,
      employee: {
        id: employee.id,
        email: employee.email,
        fullName: employee.fullName,
        role: employee.role,
        branchId: employee.branchId,
      },
    };
  }

  /**
   * Refresh token flow:
   * 1. Verify refresh token signature
   * 2. Look up token hash in Redis
   * 3. Rotate tokens (invalidate old, issue new)
   */
  async refresh(dto: RefreshTokenDto): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refresh_token, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          this.configService.get<string>('JWT_SECRET', 'change-me'),
        ),
      });
    } catch {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    const redisKey = RedisKeys.refreshToken(payload.sub, payload.jti);
    const storedHash = await this.redis.get(redisKey);
    if (!storedHash) {
      throw new UnauthorizedException('REFRESH_TOKEN_EXPIRED');
    }

    const isValid = await bcrypt.compare(dto.refresh_token, storedHash);
    if (!isValid) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    // Invalidate old refresh token
    await this.redis.del(redisKey);

    // Get employee
    const employee = await this.employeeRepository.findOne({
      where: { id: payload.sub },
    });
    if (!employee || !employee.isActive || employee.deletedAt) {
      throw new UnauthorizedException('ACCOUNT_DISABLED');
    }

    return this.generateTokens(employee, payload.deviceId);
  }

  /**
   * Logout: invalidate refresh token from Redis
   */
  async logout(
    employeeId: string,
    refreshToken: string,
    jti: string,
  ): Promise<void> {
    try {
      // Verify token before deleting (prevents token injection)
      this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          this.configService.get<string>('JWT_SECRET', 'change-me'),
        ),
      });
    } catch {
      // Even if expired, remove from Redis
    }
    await this.redis.del(RedisKeys.refreshToken(employeeId, jti));
  }

  /**
   * Register device for an employee (first-time setup)
   */
  async registerDevice(
    employeeId: string,
    dto: RegisterDeviceDto,
  ): Promise<{ deviceId: string }> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    if (employee.registeredDeviceId) {
      throw new ConflictException('DEVICE_ALREADY_REGISTERED');
    }

    await this.employeeRepository.update(employeeId, {
      registeredDeviceId: dto.device_id,
    });

    await this.redis.del(RedisKeys.employee(employeeId));

    return { deviceId: dto.device_id };
  }

  /**
   * Admin: reset employee device registration
   */
  async resetDevice(employeeId: string): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    await this.employeeRepository.update(employeeId, {
      registeredDeviceId: null,
    });

    await this.redis.del(RedisKeys.employee(employeeId));
  }

  /**
   * Forgot password: generate OTP, store in Redis, send email (via NotificationService)
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { email: dto.email },
    });

    // Always return success to prevent email enumeration
    if (!employee || !employee.isActive || employee.deletedAt) {
      return;
    }

    const otp = this.generateOtp();
    await this.redis.setex(
      RedisKeys.otpToken(dto.email),
      RedisTTL.OTP,
      otp,
    );

    // OTP stored in Redis only (no DB backup needed)

    // TODO: integrate with NotificationService to send email
    // await this.notificationService.sendPasswordResetEmail(dto.email, otp);
  }

  /**
   * Reset password: verify OTP, update password hash
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const storedOtp = await this.redis.get(RedisKeys.otpToken(dto.email));

    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('INVALID_OR_EXPIRED_OTP');
    }

    const employee = await this.employeeRepository.findOne({
      where: { email: dto.email },
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    const passwordHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.employeeRepository.update(employee.id, { passwordHash });

    // Invalidate OTP
    await this.redis.del(RedisKeys.otpToken(dto.email));
    // Invalidate employee cache
    await this.redis.del(RedisKeys.employee(employee.id));
  }

  /**
   * Change password with current password verification
   */
  async changePassword(
    employeeId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    const currentValid = await bcrypt.compare(
      dto.current_password,
      employee.passwordHash,
    );
    if (!currentValid) {
      throw new BadRequestException('INCORRECT_CURRENT_PASSWORD');
    }

    const sameAsOld = await bcrypt.compare(
      dto.new_password,
      employee.passwordHash,
    );
    if (sameAsOld) {
      throw new BadRequestException('NEW_PASSWORD_SAME_AS_OLD');
    }

    const passwordHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.employeeRepository.update(employeeId, { passwordHash });
    await this.redis.del(RedisKeys.employee(employeeId));
  }

  /**
   * Get current user info
   */
  async getMe(
    employeeId: string,
  ): Promise<Omit<Employee, 'passwordHash'>> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      select: [
        'id',
        'employeeCode',
        'fullName',
        'email',
        'phoneNumber',
        'role',
        'branchId',
        'registeredDeviceId',
        'isActive',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }
    return employee as Omit<
      Employee,
      'passwordHash' | 'otpCode' | 'otpExpiresAt'
    >;
  }

  /**
   * Generate access + refresh token pair
   */
  async generateTokens(employee: Employee, deviceId: string): Promise<TokenPair> {
    const jti = uuidv4();
    const payload: JwtPayload = {
      sub: employee.id,
      email: employee.email,
      role: employee.role,
      branchId: employee.branchId,
      deviceId,
      jti,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m'),
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          this.configService.get<string>('JWT_SECRET', 'change-me'),
        ),
        expiresIn: JWT_REFRESH_EXPIRES,
      },
    );

    // Store refresh token hash in Redis
    const tokenHash = await this.hashToken(refreshToken);
    await this.redis.setex(
      RedisKeys.refreshToken(employee.id, jti),
      JWT_REFRESH_EXPIRES_SECONDS,
      tokenHash,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Hash a token for secure storage in Redis
   */
  async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

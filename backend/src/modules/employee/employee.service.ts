import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { Employee, EmployeeRole } from './employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationQueryDto } from '../branch/dto/pagination-query.dto';
import { PaginatedResult } from '../branch/branch.service';
import { REDIS_CLIENT, RedisKeys, RedisTTL } from '../../config/redis.config';

const BCRYPT_ROUNDS = 12;

export interface CachedEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  branchId: string | null;
  registeredDeviceId: string | null;
  isActive: boolean;
}

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAll(
    query: PaginationQueryDto,
    scopedBranchId?: string | null,
  ): Promise<PaginatedResult<Omit<Employee, 'passwordHash'>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.employeeRepository
      .createQueryBuilder('emp')
      .select([
        'emp.id',
        'emp.employeeCode',
        'emp.fullName',
        'emp.email',
        'emp.phoneNumber',
        'emp.role',
        'emp.branchId',
        'emp.registeredDeviceId',
        'emp.isActive',
        'emp.lastLoginAt',
        'emp.createdAt',
        'emp.updatedAt',
      ])
      .where('emp.deleted_at IS NULL');

    if (scopedBranchId) {
      qb.andWhere('emp.branch_id = :branchId', { branchId: scopedBranchId });
    } else if (query.branch_id) {
      qb.andWhere('emp.branch_id = :branchId', { branchId: query.branch_id });
    }

    if (query.search) {
      qb.andWhere(
        '(emp.full_name ILIKE :search OR emp.email ILIKE :search OR emp.employee_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status && query.status !== 'all') {
      qb.andWhere('emp.is_active = :isActive', {
        isActive: query.status === 'active',
      });
    }

    const [items, total] = await qb
      .orderBy('emp.fullName', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items: items as Omit<Employee, 'passwordHash'>[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    id: string,
  ): Promise<Omit<Employee, 'passwordHash'>> {
    const employee = await this.employeeRepository.findOne({
      where: { id, deletedAt: IsNull() },
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
    return employee as Omit<Employee, 'passwordHash'>;
  }

  async create(dto: CreateEmployeeDto): Promise<Omit<Employee, 'passwordHash'>> {
    const existingByEmail = await this.employeeRepository.findOne({
      where: { email: dto.email },
    });
    if (existingByEmail) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    const existingByCode = await this.employeeRepository.findOne({
      where: { employeeCode: dto.employee_code },
    });
    if (existingByCode) {
      throw new ConflictException('EMPLOYEE_CODE_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const employee = this.employeeRepository.create({
      employeeCode: dto.employee_code,
      fullName: dto.full_name,
      email: dto.email,
      passwordHash,
      phoneNumber: dto.phone_number ?? null,
      role: dto.role ?? EmployeeRole.EMPLOYEE,
      branchId: dto.branch_id ?? null,
      isActive: dto.is_active ?? true,
    });

    const saved = await this.employeeRepository.save(employee);
    return this.findOne(saved.id);
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<Omit<Employee, 'passwordHash'>> {
    const employee = await this.employeeRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    if (dto.email && dto.email !== employee.email) {
      const existing = await this.employeeRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('EMAIL_ALREADY_EXISTS');
      }
    }

    await this.employeeRepository.update(id, {
      ...(dto.full_name !== undefined && { fullName: dto.full_name }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone_number !== undefined && { phoneNumber: dto.phone_number }),
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.branch_id !== undefined && { branchId: dto.branch_id }),
      ...(dto.is_active !== undefined && { isActive: dto.is_active }),
    });

    // Invalidate cache
    await this.redis.del(RedisKeys.employee(id));

    return this.findOne(id);
  }

  async setStatus(id: string, isActive: boolean): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    await this.employeeRepository.update(id, { isActive });
    await this.redis.del(RedisKeys.employee(id));
  }

  async resetDevice(id: string): Promise<void> {
    const employee = await this.employeeRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!employee) {
      throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    }

    await this.employeeRepository.update(id, { registeredDeviceId: null });
    await this.redis.del(RedisKeys.employee(id));
  }

  /**
   * Find by email — used for auth, returns full entity including passwordHash
   */
  async findByEmail(email: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({
      where: { email, deletedAt: IsNull() },
    });
  }

  /**
   * Get Redis-cached employee or fetch from DB and cache
   */
  async getRedisCache(id: string): Promise<CachedEmployee | null> {
    const cached = await this.redis.get(RedisKeys.employee(id));
    if (cached) {
      return JSON.parse(cached) as CachedEmployee;
    }

    const employee = await this.employeeRepository.findOne({
      where: { id, deletedAt: IsNull(), isActive: true },
      select: [
        'id',
        'employeeCode',
        'fullName',
        'email',
        'role',
        'branchId',
        'registeredDeviceId',
        'isActive',
      ],
    });

    if (!employee) {
      return null;
    }

    const cacheData: CachedEmployee = {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      role: employee.role,
      branchId: employee.branchId,
      registeredDeviceId: employee.registeredDeviceId,
      isActive: employee.isActive,
    };

    await this.redis.setex(
      RedisKeys.employee(id),
      RedisTTL.EMPLOYEE,
      JSON.stringify(cacheData),
    );

    return cacheData;
  }

  async countActive(): Promise<number> {
    return this.employeeRepository.count({
      where: { isActive: true, deletedAt: IsNull() },
    });
  }
}

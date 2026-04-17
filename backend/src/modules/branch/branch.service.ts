import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import Redis from 'ioredis';
import { Branch } from './branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { REDIS_CLIENT, RedisKeys, RedisTTL } from '../../config/redis.config';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BranchConfig {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  wifiBssids: string[];
  wifiSsids: string[];
  timezone: string;
  isActive: boolean;
}

@Injectable()
export class BranchService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Branch>> {
    try {
      const page = query.page ?? 1;
      const limit = query.per_page ?? query.limit ?? 20;
      const skip = (page - 1) * limit;

      const qb = this.branchRepository
        .createQueryBuilder('branch')
        .where('branch.deletedAt IS NULL');

      if (query.search) {
        qb.andWhere(
          '(branch.name ILIKE :search OR branch.code ILIKE :search OR branch.address ILIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      if (query.status && query.status !== 'all') {
        qb.andWhere('branch.isActive = :isActive', {
          isActive: query.status === 'active',
        });
      }

      const [items, total] = await qb
        .orderBy('branch.name', 'ASC')
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
    } catch (e: unknown) {
      throw new Error('findAll Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async findOne(id: string): Promise<Branch> {
    // Try Redis cache first
    const cached = await this.redis.get(RedisKeys.branch(id));
    if (cached) {
      return JSON.parse(cached) as Branch;
    }

    const branch = await this.branchRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!branch) {
      throw new NotFoundException('BRANCH_NOT_FOUND');
    }

    await this.redis.setex(
      RedisKeys.branch(id),
      RedisTTL.BRANCH,
      JSON.stringify(branch),
    );

    return branch;
  }

  async create(dto: CreateBranchDto): Promise<Branch> {
    const existing = await this.branchRepository.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('BRANCH_CODE_EXISTS');
    }

    const branch = this.branchRepository.create({
      code: dto.code,
      name: dto.name,
      address: dto.address ?? '',
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radius_meters ?? 100,
      wifiBssids: dto.wifi_bssids ?? [],
      wifiSsids: dto.wifi_ssids ?? [],
      timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
      isActive: dto.is_active ?? true,
    });

    const saved = await this.branchRepository.save(branch) as Branch;

    await this.redis.setex(
      RedisKeys.branch(saved.id),
      RedisTTL.BRANCH,
      JSON.stringify(saved),
    );

    return saved;
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);

    const updated = this.branchRepository.merge(branch, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.latitude !== undefined && { latitude: dto.latitude }),
      ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      ...(dto.radius_meters !== undefined && { radiusMeters: dto.radius_meters }),
      ...(dto.wifi_bssids !== undefined && { wifiBssids: dto.wifi_bssids }),
      ...(dto.wifi_ssids !== undefined && { wifiSsids: dto.wifi_ssids }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.is_active !== undefined && { isActive: dto.is_active }),
    });

    const saved = await this.branchRepository.save(updated) as Branch;

    await this.redis.del(RedisKeys.branch(id));

    return saved;
  }

  async softDelete(id: string): Promise<void> {
    const branch = await this.findOne(id);
    await this.branchRepository.update(branch.id, { deletedAt: new Date() });
    await this.redis.del(RedisKeys.branch(id));
  }

  /**
   * Get branch config for attendance validation (Redis-cached, lean version)
   */
  async getBranchConfig(id: string): Promise<BranchConfig> {
    const branch = await this.findOne(id);
    return {
      id: branch.id,
      lat: Number(branch.latitude),
      lng: Number(branch.longitude),
      radius: branch.radiusMeters,
      wifiBssids: branch.wifiBssids,
      wifiSsids: branch.wifiSsids,
      timezone: branch.timezone,
      isActive: branch.isActive,
    };
  }
}

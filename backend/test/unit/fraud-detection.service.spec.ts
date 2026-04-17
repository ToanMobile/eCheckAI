import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FraudDetectionService } from '../../src/modules/fraud/fraud-detection.service';
import { FraudLogService } from '../../src/modules/fraud/fraud-log.service';
import { FraudLog, FraudType, FraudSeverity } from '../../src/modules/fraud/fraud-log.entity';

// u2500u2500 FraudDetectionService suite u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  const mockFraudLogRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => ({ ...entity, id: 'fl-uuid-1', createdAt: new Date() })),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        { provide: getRepositoryToken(FraudLog), useValue: mockFraudLogRepo },
      ],
    }).compile();

    service = module.get<FraudDetectionService>(FraudDetectionService);
  });

  it('should_create_fraud_log_when_logFraud_called', async () => {
    const input = {
      employeeId: 'emp-uuid-1',
      branchId: 'branch-uuid-1',
      fraudType: FraudType.VPN_DETECTED,
      ipAddress: '1.2.3.4',
      deviceId: 'dev-001',
      details: { ip: '1.2.3.4' },
    };

    const result = await service.logFraud({
      ...input,
      fraudType: 'vpn_detected',
    });

    expect(mockFraudLogRepo.create).toHaveBeenCalled();
    expect(mockFraudLogRepo.save).toHaveBeenCalled();
    expect(result).toHaveProperty('id');
  });

  it('should_return_employee_fraud_logs_when_getLogsForEmployee_called', async () => {
    mockFraudLogRepo.find.mockResolvedValue([
      { id: 'fl-1', employeeId: 'emp-uuid-1', fraudType: FraudType.VPN_DETECTED },
    ]);

    const logs = await service.getLogsForEmployee('emp-uuid-1');
    expect(logs).toHaveLength(1);
    expect(mockFraudLogRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp-uuid-1' } }),
    );
  });

  it('should_return_paginated_logs_when_getRecentLogs_called', async () => {
    mockFraudLogRepo.createQueryBuilder.mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [{ id: 'fl-1' }],
        1,
      ]),
    });

    const result = await service.getRecentLogs(1, 10);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('should_filter_by_branch_when_branchId_provided', async () => {
    const whereMock = jest.fn().mockReturnThis();
    mockFraudLogRepo.createQueryBuilder.mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      where: whereMock,
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });

    await service.getRecentLogs(1, 10, 'branch-uuid-1');
    expect(whereMock).toHaveBeenCalledWith(
      'fl.branch_id = :branchId',
      { branchId: 'branch-uuid-1' },
    );
  });
});

// u2500u2500 FraudLogService suite u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

describe('FraudLogService', () => {
  let service: FraudLogService;

  const mockFraudLogRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => ({
      ...entity,
      id: 'fl-uuid-new',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudLogService,
        { provide: getRepositoryToken(FraudLog), useValue: mockFraudLogRepo },
      ],
    }).compile();

    service = module.get<FraudLogService>(FraudLogService);
  });

  it('should_create_fraud_log_with_medium_severity_by_default', async () => {
    const result = await service.logFraud({
      employeeId: 'emp-uuid-1',
      fraudType: FraudType.WIFI_MISMATCH,
    });

    expect(result).toHaveProperty('id', 'fl-uuid-new');
    expect(mockFraudLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ severity: FraudSeverity.MEDIUM }),
    );
  });

  it('should_create_fraud_log_with_given_severity', async () => {
    await service.logFraud({
      employeeId: 'emp-uuid-1',
      fraudType: FraudType.VPN_DETECTED,
      severity: FraudSeverity.CRITICAL,
    });

    expect(mockFraudLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ severity: FraudSeverity.CRITICAL }),
    );
  });

  it('should_return_fraud_log_when_getOne_found', async () => {
    const log = { id: 'fl-uuid-1', fraudType: FraudType.MOCK_LOCATION };
    mockFraudLogRepo.findOne.mockResolvedValue(log);

    const result = await service.getOne('fl-uuid-1');
    expect(result).toBe(log);
  });

  it('should_throw_not_found_when_getOne_missing', async () => {
    mockFraudLogRepo.findOne.mockResolvedValue(null);

    await expect(service.getOne('ghost-id')).rejects.toThrow(NotFoundException);
  });

  it('should_set_resolved_fields_when_resolve_called', async () => {
    const log: Partial<FraudLog> = {
      id: 'fl-uuid-1',
      fraudType: FraudType.DEVICE_MISMATCH,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    };
    mockFraudLogRepo.findOne.mockResolvedValue(log);
    mockFraudLogRepo.save.mockResolvedValue({
      ...log,
      resolvedAt: new Date(),
      resolvedBy: 'admin-uuid',
      resolutionNote: 'Verified in person',
    });

    const result = await service.resolve(
      'fl-uuid-1',
      'admin-uuid',
      'Verified in person',
    );

    expect(result.resolvedAt).toBeTruthy();
    expect(result.resolvedBy).toBe('admin-uuid');
    expect(result.resolutionNote).toBe('Verified in person');
  });

  it('should_return_paginated_results_when_getAll_called', async () => {
    const andWhereMock = jest.fn().mockReturnThis();
    mockFraudLogRepo.createQueryBuilder.mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      andWhere: andWhereMock,
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'fl-1' }], 1]),
    });

    const result = await service.getAll({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('should_filter_by_severity_and_fraud_type_when_query_provided', async () => {
    const andWhereMock = jest.fn().mockReturnThis();
    mockFraudLogRepo.createQueryBuilder.mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      andWhere: andWhereMock,
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });

    await service.getAll({
      severity: FraudSeverity.HIGH,
      fraudType: FraudType.VPN_DETECTED,
      resolved: false,
    });

    expect(andWhereMock).toHaveBeenCalledWith(
      'fl.severity = :severity',
      { severity: FraudSeverity.HIGH },
    );
    expect(andWhereMock).toHaveBeenCalledWith(
      'fl.fraud_type = :fraudType',
      { fraudType: FraudType.VPN_DETECTED },
    );
    expect(andWhereMock).toHaveBeenCalledWith('fl.resolved_at IS NULL');
  });
});

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../config/jwt.config';
import { EmployeeRole } from '../employee/employee.entity';
import { FraudSeverity, FraudType, FraudLog } from './fraud-log.entity';
import {
  FraudLogQueryDto,
  FraudLogService,
  PaginatedFraudLogs,
} from './fraud-log.service';

interface ScopedRequest extends Request {
  scopedBranchId?: string | null;
}

class ResolveDto {
  resolution_note!: string;
}

@Controller('fraud')
export class FraudController {
  constructor(private readonly fraudLogService: FraudLogService) {}

  /**
   * GET /fraud/logs
   * List fraud logs with optional filters (paginated).
   * branch_manager: scoped to their own branch via BranchScopeGuard
   *   (req.scopedBranchId overrides any query param they might pass).
   * hr / super_admin: can query any branch or all branches.
   */
  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
  @Roles(EmployeeRole.BRANCH_MANAGER, EmployeeRole.HR, EmployeeRole.SUPER_ADMIN)
  async getLogs(
    @Req() req: ScopedRequest,
    @Query('branchId') branchId?: string,
    @Query('severity') severity?: FraudSeverity,
    @Query('fraudType') fraudType?: FraudType,
    @Query('resolved') resolvedRaw?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedFraudLogs> {
    let resolved: boolean | undefined;
    if (resolvedRaw === 'true') resolved = true;
    else if (resolvedRaw === 'false') resolved = false;

    // BranchScopeGuard injects scopedBranchId:
    //   - branch_manager => their own branchId (mandatory)
    //   - hr / super_admin => query param value or null (all branches)
    const effectiveBranchId =
      req.scopedBranchId !== undefined
        ? (req.scopedBranchId ?? undefined)
        : branchId;

    const query: FraudLogQueryDto = {
      branchId: effectiveBranchId,
      severity,
      fraudType,
      resolved,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    return this.fraudLogService.getAll(query);
  }

  /**
   * GET /fraud/logs/:id
   * Get full details of a single fraud log.
   */
  @Get('logs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(EmployeeRole.BRANCH_MANAGER, EmployeeRole.HR, EmployeeRole.SUPER_ADMIN)
  async getLog(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FraudLog> {
    return this.fraudLogService.getOne(id);
  }

  /**
   * PATCH /fraud/logs/:id/resolve
   * Mark a fraud log as resolved.
   */
  @Patch('logs/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(EmployeeRole.BRANCH_MANAGER, EmployeeRole.HR, EmployeeRole.SUPER_ADMIN)
  async resolveLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<FraudLog> {
    return this.fraudLogService.resolve(id, user.sub, body.resolution_note);
  }
}

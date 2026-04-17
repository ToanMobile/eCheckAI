import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Request } from 'express';
import { AttendanceService } from './attendance.service';
import { AutoCheckinDto } from './dto/auto-checkin.dto';
import { ManualCheckinDto } from './dto/manual-checkin.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EmployeeRole } from '../employee/employee.entity';
import { JwtPayload } from '../../config/jwt.config';

interface ScopedRequest extends Request {
  scopedBranchId?: string | null;
}

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('auto-checkin')
  @HttpCode(HttpStatus.OK)
  async autoCheckin(
    @Body() dto: AutoCheckinDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
    return this.attendanceService.autoCheckin(dto, ip);
  }

  @Post('auto-checkout')
  @HttpCode(HttpStatus.OK)
  async autoCheckout(
    @Body() dto: AutoCheckinDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
    return this.attendanceService.autoCheckout(dto, ip);
  }

  @Post('manual')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    EmployeeRole.BRANCH_MANAGER,
    EmployeeRole.HR,
    EmployeeRole.SUPER_ADMIN,
  )
  async manualCheckin(
    @Body() dto: ManualCheckinDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attendanceService.manualCheckin(dto, user.sub);
  }

  @Get()
  @UseGuards(BranchScopeGuard)
  @Roles(
    EmployeeRole.BRANCH_MANAGER,
    EmployeeRole.HR,
    EmployeeRole.SUPER_ADMIN,
  )
  async findAll(
    @Query() query: AttendanceQueryDto,
    @Req() req: ScopedRequest,
  ) {
    return this.attendanceService.findAll(query, req.scopedBranchId);
  }

  @Get('stats')
  @UseGuards(BranchScopeGuard)
  @Roles(
    EmployeeRole.BRANCH_MANAGER,
    EmployeeRole.HR,
    EmployeeRole.SUPER_ADMIN,
  )
  async getStats(@Query() query: AttendanceQueryDto, @Req() req: ScopedRequest) {
    return this.attendanceService.getStats(
      req.scopedBranchId ?? query.branch_id,
      query.date_from,
      query.date_to,
    );
  }

  @Get('export')
  @UseGuards(BranchScopeGuard)
  @Roles(
    EmployeeRole.BRANCH_MANAGER,
    EmployeeRole.HR,
    EmployeeRole.SUPER_ADMIN,
  )
  async exportCsv(
    @Query() query: AttendanceQueryDto,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.attendanceService.exportCsv(
      query.branch_id,
      query.date_from,
      query.date_to,
      query.status,
      req.scopedBranchId,
    );
    const filename = `attendance_${query.date_from ?? 'all'}_${query.date_to ?? 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}

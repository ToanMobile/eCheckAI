import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PaginationQueryDto } from '../branch/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EmployeeRole } from '../employee/employee.entity';
import { JwtPayload } from '../../config/jwt.config';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @Roles(
    EmployeeRole.BRANCH_MANAGER,
    EmployeeRole.HR,
    EmployeeRole.SUPER_ADMIN,
  )
  async findByBranch(@Query() query: PaginationQueryDto) {
    const limit = query.per_page ?? query.limit ?? 200;
    return this.scheduleService.findAll(limit, query.page ?? 1, query.branch_id);
  }

  /**
   * GET /schedules/my u2014 employee gets their own branch's active schedule
   * Must be before ":id" route to avoid UUID parse error
   */
  @Get('my')
  async findMy(@CurrentUser() user: JwtPayload) {
    if (!user.branchId) {
      return [];
    }
    return this.scheduleService.findMySchedule(user.branchId);
  }

  @Get(':id')
  @Roles(
    EmployeeRole.BRANCH_MANAGER,
    EmployeeRole.HR,
    EmployeeRole.SUPER_ADMIN,
  )
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(EmployeeRole.BRANCH_MANAGER, EmployeeRole.SUPER_ADMIN)
  async create(@Body() dto: CreateScheduleDto) {
    return this.scheduleService.create(dto);
  }

  @Put(':id')
  @Roles(EmployeeRole.BRANCH_MANAGER, EmployeeRole.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.update(id, dto);
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from './attendance.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PartitionManagerService } from './partition-manager.service';
import { BranchModule } from '../branch/branch.module';
import { EmployeeModule } from '../employee/employee.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { FraudModule } from '../fraud/fraud.module';
import { redisClientProvider } from '../../config/redis.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord]),
    BranchModule,
    EmployeeModule,
    ScheduleModule,
    FraudModule,
  ],
  providers: [AttendanceService, PartitionManagerService, redisClientProvider],
  controllers: [AttendanceController],
  exports: [AttendanceService, PartitionManagerService],
})
export class AttendanceModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncQueueItem } from './sync-queue.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [TypeOrmModule.forFeature([SyncQueueItem]), AttendanceModule],
  providers: [SyncService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudLog } from './fraud-log.entity';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudLogService } from './fraud-log.service';
import { FraudController } from './fraud.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FraudLog])],
  providers: [FraudDetectionService, FraudLogService],
  controllers: [FraudController],
  exports: [FraudDetectionService, FraudLogService],
})
export class FraudModule {}

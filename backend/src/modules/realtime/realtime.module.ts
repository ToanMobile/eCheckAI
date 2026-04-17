import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeGateway } from './realtime.gateway';
import { AttendanceRecord } from '../attendance/attendance.entity';
import { FraudLog } from '../fraud/fraud-log.entity';
import { redisClientProvider } from '../../config/redis.config';
import { jwtConfig } from '../../config/jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync(jwtConfig),
    TypeOrmModule.forFeature([AttendanceRecord, FraudLog]),
  ],
  providers: [RealtimeGateway, redisClientProvider],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}

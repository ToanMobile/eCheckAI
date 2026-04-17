import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { TelegramAdapter } from './telegram.adapter';
import { ZaloAdapter } from './zalo.adapter';

@Module({
  imports: [ConfigModule],
  providers: [NotificationService, TelegramAdapter, ZaloAdapter],
  exports: [NotificationService, TelegramAdapter, ZaloAdapter],
})
export class NotificationModule {}

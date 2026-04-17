import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NotificationPayload {
  to: string;
  subject?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<void>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    this.logger.log(
      `[NotificationService] Sending password reset OTP to ${email}`,
    );
    // In production, integrate with nodemailer / SMTP
    // For now, log the OTP in dev
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      this.logger.debug(`OTP for ${email}: ${otp}`);
    }
  }

  async sendAttendanceAlert(
    employeeEmail: string,
    message: string,
  ): Promise<void> {
    this.logger.log(
      `[NotificationService] Attendance alert to ${employeeEmail}: ${message}`,
    );
  }

  async sendTelegramMessage(chatId: string, message: string): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.warn('[NotificationService] TELEGRAM_BOT_TOKEN not configured');
      return;
    }

    try {
      const axios = (await import('axios')).default;
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[NotificationService] Telegram send failed: ${msg}`,
      );
    }
  }
}

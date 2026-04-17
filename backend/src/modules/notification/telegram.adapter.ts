import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FraudSeverity, FraudType } from '../fraud/fraud-log.entity';

export interface CheckinAlertPayload {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchId: string;
  branchName: string;
  checkInTime: string;
  lateMinutes: number;
  status: 'on_time' | 'late';
  dashboardUrl: string;
}

export interface FraudAlertPayload {
  fraudLogId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  fraudType: FraudType;
  severity: FraudSeverity;
  details: Record<string, unknown>;
  occurredAt: string;
  dashboardUrl: string;
}

export interface AbsentReportPayload {
  branchName: string;
  reportDate: string;
  absentList: Array<{ employeeName: string; employeeCode: string }>;
  totalPresent: number;
  totalEmployees: number;
  dashboardUrl: string;
}

@Injectable()
export class TelegramAdapter {
  private readonly logger = new Logger(TelegramAdapter.name);
  private readonly botToken: string | undefined;
  private readonly apiBase: string;

  constructor(private readonly config: ConfigService) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    this.apiBase = `https://api.telegram.org/bot${this.botToken ?? ''}`;
  }

  /**
   * Template 2.1 — Late check-in alert.
   * Only sends when employee is more than 30 minutes late.
   */
  async sendLateCheckinAlert(
    chatId: string,
    payload: CheckinAlertPayload,
  ): Promise<void> {
    if (payload.lateMinutes <= 30) return;

    const text = [
      `\u{1F550} *NH\u00C2N VI\u00CAN \u0110I MU\u1ED8N*`,
      ``,
      `\u{1F464} ${this.escape(payload.employeeName)} \\(${this.escape(payload.employeeCode)}\\)`,
      `\u{1F3E2} ${this.escape(payload.branchName)}`,
      `\u23F0 Check\\-in: ${this.escape(payload.checkInTime)} \\(mu\u1ED9n ${payload.lateMinutes} ph\u00Fat\\)`,
      `\u{1F4CD} V\u1ECB tr\u00ED x\u00E1c nh\u1EADn \u2705`,
      ``,
      `[Xem chi ti\u1EBFt](${payload.dashboardUrl})`,
    ].join('\n');

    await this.sendMessage(chatId, text);
  }

  /**
   * Templates 2.2 & 2.3 — Fraud alert (general or high-severity).
   */
  async sendFraudAlert(
    chatId: string,
    payload: FraudAlertPayload,
  ): Promise<void> {
    const isHighSeverity = [
      FraudSeverity.HIGH,
      FraudSeverity.CRITICAL,
    ].includes(payload.severity);

    const fraudTypeVn: Record<FraudType, string> = {
      [FraudType.VPN_DETECTED]: 'VPN \u0111\u01B0\u1EE3c ph\u00E1t hi\u1EC7n',
      [FraudType.MOCK_LOCATION]: 'V\u1ECB tr\u00ED gi\u1EA3',
      [FraudType.DEVICE_MISMATCH]: 'Thi\u1EBFt b\u1ECB kh\u00F4ng kh\u1EDBp',
      [FraudType.WIFI_MISMATCH]: 'WiFi kh\u00F4ng \u0111\u00FAng',
      [FraudType.OUTSIDE_GEOFENCE]: 'Ngo\u00E0i khu v\u1EF1c',
      [FraudType.OUTSIDE_SCHEDULE_WINDOW]: 'Ngo\u00E0i khung gi\u1EDD',
      [FraudType.RATE_LIMIT_EXCEEDED]: 'V\u01B0\u1EE3t gi\u1EDBi h\u1EA1n',
      [FraudType.SERVER_IP_VPN]: 'IP VPN t\u1EEB server',
      [FraudType.DEVICE_FARMING]: 'Nghi ng\u1EDD \u0111\u1EB7t m\u00E1y',
    };

    const severityLabel: Record<FraudSeverity, string> = {
      [FraudSeverity.LOW]: '\u{1F7E2} TH\u1EA4P',
      [FraudSeverity.MEDIUM]: '\u{1F7E1} TRUNG B\u00CCNH',
      [FraudSeverity.HIGH]: '\u{1F7E0} CAO',
      [FraudSeverity.CRITICAL]: '\u{1F534} CRITICAL',
    };

    const prefix = isHighSeverity
      ? '\u{1F6A8} *C\u1EA2NH B\u00C1O GIAN L\u1EABN CH\u1EA4M C\u00D4NG*'
      : '\u26A0\uFE0F *Ph\u00E1t hi\u1EC7n b\u1EA5t th\u01B0\u1EDBng*';

    const text = [
      prefix,
      ``,
      `\u{1F464} ${this.escape(payload.employeeName)} \\(${this.escape(payload.employeeCode)}\\)`,
      `\u{1F3E2} ${this.escape(payload.branchName)}`,
      `\u26A0\uFE0F Lo\u1EA1i: ${fraudTypeVn[payload.fraudType] ?? payload.fraudType}`,
      `M\u1EE9c \u0111\u1ED9: ${severityLabel[payload.severity] ?? payload.severity}`,
      `\u{1F550} ${this.escape(payload.occurredAt)}`,
      ``,
      `[Xem fraud log](${payload.dashboardUrl})`,
    ].join('\n');

    await this.sendMessage(chatId, text);
  }

  /**
   * Template 2.4 — Daily absent report.
   */
  async sendAbsentReport(
    chatId: string,
    payload: AbsentReportPayload,
  ): Promise<void> {
    const absentLines = payload.absentList
      .map(
        (e) =>
          `  \u2022 ${this.escape(e.employeeName)} \\(${this.escape(e.employeeCode)}\\)`,
      )
      .join('\n');

    const text = [
      `\u{1F4CA} *B\u00C1O C\u00C1O V\u1EAFNG M\u1EEDT \u2014 ${this.escape(payload.reportDate)}*`,
      `\u{1F3E2} ${this.escape(payload.branchName)}`,
      ``,
      `\u274C V\u1EAFNG \\(kh\u00F4ng l\u00FD do\\):`,
      absentLines || '  Kh\u00F4ng c\u00F3',
      ``,
      `T\u1ED5ng h\u00F4m nay: ${payload.totalPresent} \u0111i l\u00E0m \/ ${payload.totalEmployees} nh\u00E2n vi\u00EAn`,
      ``,
      `[Xem \u0111\u1EA7y \u0111\u1EE7](${payload.dashboardUrl})`,
    ].join('\n');

    await this.sendMessage(chatId, text);
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured');
      return;
    }
    try {
      await axios.post(`${this.apiBase}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Telegram sendMessage failed to ${chatId}: ${msg}`);
    }
  }

  /**
   * Escape MarkdownV2 special characters.
   */
  private escape(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, (c) => `\\${c}`);
  }
}

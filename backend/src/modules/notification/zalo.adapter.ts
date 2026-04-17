import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ZaloAdapter {
  private readonly logger = new Logger(ZaloAdapter.name);
  private readonly accessToken: string | undefined;
  private readonly apiBase = 'https://openapi.zalo.me/v3.0/oa/message/cs';

  constructor(private readonly config: ConfigService) {
    this.accessToken = this.config.get<string>('ZALO_OA_ACCESS_TOKEN');
  }

  /**
   * Send a text message to a Zalo OA user.
   * @param userId - Zalo user ID (follower of the OA)
   * @param text   - Plain text message body
   */
  async sendMessage(userId: string, text: string): Promise<void> {
    if (!this.accessToken) {
      this.logger.warn('ZALO_OA_ACCESS_TOKEN not configured');
      return;
    }

    try {
      await axios.post(
        this.apiBase,
        {
          recipient: { user_id: userId },
          message: { text },
        },
        {
          headers: {
            access_token: this.accessToken,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Zalo sendMessage failed for user ${userId}: ${msg}`);
    }
  }
}

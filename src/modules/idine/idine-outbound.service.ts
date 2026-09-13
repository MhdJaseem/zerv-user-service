import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

/**
 * Posts events to iDine aggregator webhook URLs (Order Relay, Order Status Change, Rider Status Change).
 */
@Injectable()
export class IdineOutboundService {
  private readonly logger = new Logger(IdineOutboundService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private getTimeoutMs(): number {
    const raw = this.configService.get<string>('IDINE_WEBHOOK_TIMEOUT_MS');
    const n = raw ? parseInt(raw, 10) : 30000;
    return Number.isFinite(n) && n > 0 ? n : 30000;
  }

  private async postJson(url: string | undefined, label: string, body: unknown): Promise<void> {
    if (!url) {
      this.logger.warn(`Skipping ${label}: URL not configured`);
      return;
    }
    try {
      await lastValueFrom(
        this.httpService.post(url, body, {
          timeout: this.getTimeoutMs(),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    } catch (err) {
      this.logger.error(`${label} webhook failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async notifyPlaceOrder(payload: unknown): Promise<void> {
    const url = this.configService.get<string>('IDINE_WEBHOOK_PLACE_ORDER');
    await this.postJson(url, 'Place order', payload);
  }

  async notifyOrderStatusUpdate(payload: unknown): Promise<void> {
    const url = this.configService.get<string>(
      'IDINE_WEBHOOK_ORDER_STATUS_UPDATE',
    );
    await this.postJson(url, 'Order status update', payload);
  }

  async notifyOrderDeliveryStatus(payload: unknown): Promise<void> {
    const url = this.configService.get<string>(
      'IDINE_WEBHOOK_ORDER_DELIVERY_STATUS',
    );
    await this.postJson(url, 'Order delivery status', payload);
  }
}

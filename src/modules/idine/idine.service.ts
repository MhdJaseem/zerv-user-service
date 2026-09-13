import { Injectable, Logger } from '@nestjs/common';

import { IdineOutboundService } from './idine-outbound.service';

@Injectable()
export class IdineService {
  private readonly logger = new Logger(IdineService.name);

  constructor(private readonly idineOutboundService: IdineOutboundService) { }

  /**
   * Receives full menu snapshot from iDine/POS. Persist to menu/catalogue in a follow-up task.
   */
  async acceptMenuCatalogue(payload: any): Promise<{
    received: boolean;
    categories: number;
    items: number;
  }> {
    this.logger.log(
      `Menu catalogue received: ${payload.categories?.length ?? 0} categories, ${payload.items?.length ?? 0} items`,
    );
    return {
      received: true,
      categories: payload.categories?.length ?? 0,
      items: payload.items?.length ?? 0,
    };
  }

  /**
   * Receives POS-driven order state transitions. Map to Zerv orders in a follow-up task.
   * Also relays the status update to iDine's outbound webhook.
   */
  async acceptPosOrderStatusUpdate(
    payload: any,
  ): Promise<{ received: boolean; order_id: number; new_state: string }> {
    this.logger.log(
      `POS order status: order_id=${payload.order_id} ${payload.prev_state ?? '?'} -> ${payload.new_state}`,
    );

    // Relay to iDine's outbound webhook
    await this.idineOutboundService.notifyOrderStatusUpdate(payload);

    return {
      received: true,
      order_id: payload.order_id,
      new_state: payload.new_state,
    };
  }

  /**
   * Receives rider/delivery status changes (e.g., Completed) and relays them to iDine's outbound webhook.
   */
  async acceptOrderDeliveryStatus(
    payload: any,
  ): Promise<{ received: boolean; order_id: number; new_state: string }> {
    this.logger.log(
      `POS rider/delivery status: order_id=${payload.order_id} ${payload.prev_state ?? '?'} -> ${payload.new_state}`,
    );

    // Relay to iDine's outbound webhook (Rider Status Change)
    await this.idineOutboundService.notifyOrderDeliveryStatus(payload);

    return {
      received: true,
      order_id: payload.order_id,
      new_state: payload.new_state,
    };
  }

  /**
   * Receives "Out of stock" (OOS) report for items in an active order from iDine/POS.
   */
  async acceptOrderOos(
    payload: any,
  ): Promise<{ received: boolean; order_ref_id: string }> {
    this.logger.log(
      `POS order OOS received: ref_id=${payload.order_ref_id}, ${payload.items_oos.length} items`,
    );

    // Relay to iDine's outbound webhook (if configured in future)
    // await this.idineOutboundService.notifyOrderOos(payload);

    return {
      received: true,
      order_ref_id: payload.order_ref_id,
    };
  }

  /**
   * Receives an order from internal Zerv services or testing and forwards it to iDine's relay webhook.
   */
  async acceptPlaceOrder(
    payload: any,
  ): Promise<{ received: boolean; order_id: string }> {
    const merchantId = payload.order?.details?.merchant_ref_id;
    this.logger.log(`Received order relay request: ref_id=${merchantId}`);
    
    // Relay to iDine's outbound webhook
    await this.idineOutboundService.notifyPlaceOrder(payload);

    return {
      received: true,
      order_id: merchantId,
    };
  }
}

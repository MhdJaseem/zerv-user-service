import { Controller, Get, Post, Body, Param, Query, HttpStatus, HttpCode, BadRequestException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryOrderDto, DeliveryLocationDto } from './dto/create-delivery-order.dto';
import { DeliveryProviderEnum } from '../../common/enums/delivery.enum';
import { OrdersService } from '../orders/orders.service';

@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly ordersService: OrdersService
  ) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDelivery(@Body() createDeliveryDto: CreateDeliveryOrderDto) {
    return await this.deliveryService.createDeliveryOrder(createDeliveryDto);
  }

  @Get(':id')
  async getDeliveryById(@Param('id') deliveryId: string) {
    const delivery = await this.deliveryService.findDeliveryByOrderId(deliveryId);
    return delivery;
  }

  @Get('order/:orderId')
  async getDeliveryByOrderId(@Param('orderId') orderId: string) {
    const delivery = await this.deliveryService.findDeliveryByOrderId(orderId);
    return delivery;
  }

  // @Get('status/:id')
  // async getDeliveryStatus(@Param('id') deliveryId: string) {
  //   const status = await this.deliveryService.getDeliveryStatus(deliveryId);
  //   return { status };
  // }

  @Post('webhook/:provider')
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() webhookData: any
  ) {
    console.log(`webhook triggerd for Uber event ${webhookData?.kind} and status ${webhookData?.status}`);
    // Validate provider
    if (!Object.values(DeliveryProviderEnum).includes(provider as DeliveryProviderEnum)) {
      throw new BadRequestException(`Invalid delivery provider: ${provider}`);
    }

    // Process the webhook
    const updatedDelivery = await this.deliveryService.handleProviderWebhook(
      provider as DeliveryProviderEnum,
      webhookData
    );
    // Update the associated order if needed
    if (updatedDelivery && updatedDelivery.orderId) {
      await this.ordersService.updateOrderFromDelivery(updatedDelivery);
    }

    return { success: true, deliveryId: updatedDelivery.deliveryId };
  }

  @Post('availability/check')
  async checkDeliveryAvailability(@Body() dropoffAddress: DeliveryLocationDto) {
    return this.deliveryService.checkDeliveryAvailability(dropoffAddress);
  }
}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IdineService } from './idine.service';
import { IdineAuthGuard } from './guards/idine-auth.guard';


@Controller('integrations/idine')
@UseGuards(IdineAuthGuard)
export class IdineController {
  constructor(private readonly idineService: IdineService) { }

  @Post('menu-catalogue')
  @HttpCode(HttpStatus.OK)
  async postMenuCatalogue(@Body() body: any) {
    console.log('Menu Catalogue Body:', body);
    return this.idineService.acceptMenuCatalogue(body);
  }

  @Post('place-order')
  @HttpCode(HttpStatus.OK)
  async postPlaceOrder(@Body() body: any) {
    console.log('Place Order Body:', body);
    return this.idineService.acceptPlaceOrder(body);
  }

  @Post('order-status-update')
  @HttpCode(HttpStatus.OK)
  async postOrderStatusUpdate(@Body() body: any) {
    console.log('Order Status Update Body:', body);
    return this.idineService.acceptPosOrderStatusUpdate(body);
  }

  @Post('order-delivery-status')
  @HttpCode(HttpStatus.OK)
  async postOrderDeliveryStatus(@Body() body: any) {
    console.log('Order Delivery Status Body:', body);
    return this.idineService.acceptOrderDeliveryStatus(body);
  }

  @Post('order-oos')
  @HttpCode(HttpStatus.OK)
  async postOrderOos(@Body() body: any) {
    console.log('Order OOS Body:', body);
    return this.idineService.acceptOrderOos(body);
  }
}

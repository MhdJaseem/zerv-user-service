import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { HttpModule } from '@nestjs/axios';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [DBServicesModule, HttpModule, PaginationModule, DeliveryModule],
  controllers: [CartController],
  providers: [CartService, HttpClientService],
  exports: [CartService]
})
export class CartModule {} 
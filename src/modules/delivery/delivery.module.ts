import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DeliveryService } from './delivery.service';
import { UberDeliveryService } from './providers/uber-delivery.service';
import { AdloggsDeliveryService } from './providers/adloggs-delivery.service';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { DeliveryController } from './delivery.controller';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module';
import { EmailModule } from '../email/email.module';
import { ActionLogModule } from 'src/common/shared/action-log/actionLog.module';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    DBServicesModule,
    HttpModule,
    ConfigModule,
    PaginationModule,
    forwardRef(() => OrdersModule),
    EmailModule,
    ActionLogModule,
    AuthModule,
    HttpClientModule
  ],
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    UberDeliveryService,
    AdloggsDeliveryService,
  ],
  exports: [DeliveryService],
})
export class DeliveryModule { }

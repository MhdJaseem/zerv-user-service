import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { HttpModule } from '@nestjs/axios';
import { DeliveryModule } from '../delivery/delivery.module';
import { ActionLogModule } from 'src/common/shared/action-log/actionLog.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { MongoViewService } from 'src/common/services/mongo-view.service';
import { HttpClientModule } from 'src/common/inter-service-communication/http-client.module';

@Module({
  imports: [
    DBServicesModule,
    PaginationModule,
    HttpModule,
    forwardRef(() => DeliveryModule),
    ActionLogModule,
    EmailModule,
    ActionLogModule,
    AuthModule,
    HttpClientModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService, MongoViewService],
  exports: [OrdersService]
})
export class OrdersModule { }
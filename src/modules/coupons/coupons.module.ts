import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { HttpClientModule } from 'src/common/inter-service-communication/http-client.module';
@Module({
  imports: [DBServicesModule, HttpClientModule, PaginationModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}

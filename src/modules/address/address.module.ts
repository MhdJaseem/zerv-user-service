import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { MapProvidersModule } from '../../common/mapProviders/mapProviders.module';

@Module({
  imports: [ DBServicesModule, MapProvidersModule],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService]
})
export class AddressModule {}

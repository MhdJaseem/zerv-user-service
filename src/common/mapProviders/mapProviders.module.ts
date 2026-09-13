import { Module } from '@nestjs/common';
import { RequestProviderModule } from '../requestProviders/requestProvider.module';
import { MapService } from './mapService';
import { GoogleMapsProvider } from './providers/googleMapsProvider';
import { OlaMapsProvider } from './providers/olaMapsProvider';
import { MapProvidersController } from './mapProviders.controller';
import { MapProvidersService } from './mapProviders.service';

@Module({
  imports: [RequestProviderModule],
  controllers: [MapProvidersController],
  providers: [MapService, GoogleMapsProvider, OlaMapsProvider, MapProvidersService],
  exports: [MapService, GoogleMapsProvider, OlaMapsProvider, MapProvidersService],
})
export class MapProvidersModule { }

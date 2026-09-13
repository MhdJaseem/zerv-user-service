import { Module } from '@nestjs/common';
import { PrintingController } from './printing.controller';
import { PrintingService } from './printing.service';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module';
import { DBServicesModule } from '../../common/repository/repository-services.module';

@Module({
  imports: [HttpClientModule, DBServicesModule],
  controllers: [PrintingController],
  providers: [PrintingService],
})
export class PrintingModule {}



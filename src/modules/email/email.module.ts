import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { HttpModule } from '@nestjs/axios';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { ConfigService } from '@nestjs/config';
@Module({
  imports: [DBServicesModule, HttpModule,PaginationModule],
  controllers: [EmailController],
  providers: [EmailService, HttpClientService,ConfigService],
  exports: [EmailService]
})
export class EmailModule {} 
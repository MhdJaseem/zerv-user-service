import { Module } from '@nestjs/common';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { AdminUserModule } from '../admin-users/admin-user.module';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module';

@Module({
  imports: [DBServicesModule, PaginationModule, AdminUserModule, HttpClientModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule { }


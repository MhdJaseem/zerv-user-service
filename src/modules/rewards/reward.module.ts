import { Module } from '@nestjs/common';
import { RewardService } from './reward.service';
import { RewardController } from './reward.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module';
import { AuthModule } from '../auth/auth.module';
import { ActionLogModule } from '../../common/shared/action-log/actionLog.module';

@Module({
  imports: [
    DBServicesModule,
    PaginationModule,
    HttpClientModule,
    AuthModule,
    ActionLogModule
  ],
  controllers: [RewardController],
  providers: [RewardService],
  exports: [RewardService]
})
export class RewardModule {} 
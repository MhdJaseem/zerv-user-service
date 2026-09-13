import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdineController } from './idine.controller';
import { IdineService } from './idine.service';
import { IdineOutboundService } from './idine-outbound.service';
import { IdineAuthGuard } from './guards/idine-auth.guard';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [IdineController],
  providers: [IdineService, IdineOutboundService, IdineAuthGuard],
  exports: [IdineService, IdineOutboundService],
})
export class IdineModule {}

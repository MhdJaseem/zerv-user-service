import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DBServicesModule, AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule { }

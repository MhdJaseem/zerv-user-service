import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DBServicesModule,
    HttpClientModule,
    PaginationModule,
    AuthModule
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule { } 
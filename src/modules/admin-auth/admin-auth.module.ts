import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthService } from './admin-auth.service';
import { AdminUserModule } from '../admin-users/admin-user.module';
import { AdminAuthController } from './admin-auth.controller';
import { DBServicesModule } from 'src/common/repository/repository-services.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_TOKEN_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
    AdminUserModule,
    DBServicesModule
  ],
  providers: [
    AdminAuthService
  ],
  controllers: [AdminAuthController],
})
export class AdminAuthModule { }
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import * as AWS from 'aws-sdk';
import { GoogleStrategy } from './google.strategy';
import { CognitoService } from './cognito-sso.service';
import { OAuthService } from './oauth.service';

@Module({
  imports: [
    DBServicesModule,
    EmailModule,
    SmsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_TOKEN_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CognitoService,
    GoogleStrategy,
    OAuthService,
    {
      provide: AWS.SNS,
      useFactory: () => {
        AWS.config.update({
          region: process.env.AWS_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });
        return new AWS.SNS();
      }
    }
  ],
  exports: [AuthService, CognitoService, PassportModule, OAuthService]
})
export class AuthModule { }

import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { UserModule } from './modules/user/user.module';
import { RewardModule } from './modules/rewards/reward.module';
import { AdminUserModule } from './modules/admin-users/admin-user.module';
import { AddressModule } from './modules/address/address.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ClientIdMiddleware } from './common/middlewares/clientId.middleware';
import { HttpClientModule } from './common/inter-service-communication/http-client.module';
import { LoginMiddlewareExcludedApiRoutes, LoginMiddlewareExcludedApiMethods } from './common/enums/common.enum';
import { CouponsModule } from './modules/coupons/coupons.module';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { PrintingModule } from './modules/printing/printing.module';
import emailConfig from './common/config/email.config';
import { CustomersModule } from './modules/customers/customers.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { LeadsModule } from './modules/leads/leads.module';
import { IdineModule } from './modules/idine/idine.module';
import { ContactUsModule } from './modules/contact-us/contact-us.module';

const ENV = process.env.NODE_ENV

@Module({
  imports: [ConfigModule.forRoot({
    envFilePath: !ENV ? '.env' : `.env.${ENV}`,
    load: [emailConfig]
  }),
  MongooseModule.forRoot(process.env.MONGODB_URL || 'mongodb://localhost:27017/defaultdb'),
  ScheduleModule.forRoot(),
    UserModule,
    AddressModule,
    AuthModule,
    CartModule,
    HttpClientModule,
    OrdersModule,
    AdminUserModule,
    AdminAuthModule,
    RewardModule,
    DeliveryModule,
    CouponsModule,
    PrintingModule,
    CustomersModule,
    ReviewsModule,
    LeadsModule,
    IdineModule,
    ContactUsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    consumer
      .apply(LoggerMiddleware)
      .exclude(
        ...Object.entries(LoginMiddlewareExcludedApiRoutes).map(([path, route]) => ({
          path,
          method: LoginMiddlewareExcludedApiMethods[route],
        }))
      )
      .forRoutes('*');

    consumer
      .apply(ClientIdMiddleware)
      .exclude(
        { path: 'restaurant', method: RequestMethod.POST },
        { path: 'user/analytics', method: RequestMethod.GET },
        { path: LoginMiddlewareExcludedApiRoutes.HEALTH, method: LoginMiddlewareExcludedApiMethods[LoginMiddlewareExcludedApiRoutes.HEALTH] },
        { path: 'delivery/webhook/:provider', method: RequestMethod.POST },
        { path: 'integrations/idine/menu-catalogue', method: RequestMethod.POST },
        { path: 'integrations/idine/order-status-update', method: RequestMethod.POST },
        { path: 'auth/google', method: RequestMethod.GET },
        { path: 'auth/google/callback', method: RequestMethod.GET },
        { path: 'auth/login', method: RequestMethod.GET },
        { path: 'auth/cognito/login', method: RequestMethod.GET },
        { path: 'auth/cognito/callback', method: RequestMethod.GET },
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'auth/leads/signup', method: RequestMethod.POST },
        { path: 'auth/regenerate-lead-otp', method: RequestMethod.POST },
        { path: 'auth/verify-lead-otp', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}

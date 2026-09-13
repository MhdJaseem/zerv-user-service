import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../../modules/user/entities/user.entity';
import { Reward, RewardSchema } from '../../../modules/rewards/entities/reward.entity';
import { Cart, CartSchema } from '../../../modules/cart/entities/cart.entity';
import { Order, OrderSchema } from '../../../modules/orders/entities/order.entity';
import { Address, AddressSchema } from '../../../modules/address/entities/address.entity';
import { IMongoDBServices } from './abstract.repository';
import { MongoDBServices } from './repository.service';
import { AdminUser, AdminUserSchema } from '../../../modules/admin-users/entities/admin-user.entity';
import { Lead, LeadSchema } from '../../../modules/leads/entity/lead.entity';
import { DeliveryOrder, DeliveryOrderSchema } from 'src/modules/delivery/entities/delivery-order.entity';
import { ActionLogs, ActionLogsSchema } from '../entities/actionLog.entity';
import { RewardTransactionLog, RewardTransactionLogSchema } from '../entities/reward-transaction-log.entity';
import { CouponsLogs, CouponsLogsSchema } from 'src/modules/coupons/entity/coupons-logs.entity';
import { Coupon, CouponSchema } from 'src/modules/coupons/entity/coupons.entity';
import { PrintJob, PrintJobSchema } from '../entities/print-job.entity';
import { Restaurant, RestaurantSchema } from '../entities/restaurant.entity';
import { Branch, BranchSchema } from '../entities/branch.entity';
import { Review, ReviewSchema } from '../../../modules/reviews/entities/review.entity';
import { ReviewVisibility, ReviewVisibilitySchema } from '../../../modules/reviews/entities/review-visibility.entity';
import { OtpSessions, OtpSessionsSchema } from 'src/modules/auth/entity/otp-sessions.entity';
import { UserAnalyticsMv, UserAnalyticsMvSchema } from '../entities/user-analytics-mv.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Reward.name, schema: RewardSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: CouponsLogs.name, schema: CouponsLogsSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Address.name, schema: AddressSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: DeliveryOrder.name, schema: DeliveryOrderSchema },
      { name: ActionLogs.name, schema: ActionLogsSchema },
      { name: RewardTransactionLog.name, schema: RewardTransactionLogSchema },
      { name: PrintJob.name, schema: PrintJobSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: ReviewVisibility.name, schema: ReviewVisibilitySchema },
      { name: OtpSessions.name, schema: OtpSessionsSchema },
      { name: UserAnalyticsMv.name, schema: UserAnalyticsMvSchema }
    ]),
  ],
  providers: [
    {
      provide: IMongoDBServices,
      useClass: MongoDBServices,
    },
  ],
  exports: [IMongoDBServices],
})
export class MongoDBServicesModule {
  constructor() {
    console.log('MongoDBServicesModule loaded');
  }
}
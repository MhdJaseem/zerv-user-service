import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../modules/user/entities/user.entity';
import { Cart, CartDocument } from '../../../modules/cart/entities/cart.entity';
import { Order, OrderDocument } from '../../../modules/orders/entities/order.entity';
import { Address, AddressDocument } from '../../../modules/address/entities/address.entity';
import { IUser } from '../../../common/interfaces/user.interface';
import { ICart } from '../../../common/interfaces/cart.interface';
import { IOrder } from '../../../common/interfaces/order.interface';
import { IAddress } from '../../../common/interfaces/address.interface';
import { MongoRepository } from './repository';
import { IMongoRepository } from './repository.abstract';
import { IMongoDBServices } from './abstract.repository';
import { AdminUser, AdminUserDocument } from '../../../modules/admin-users/entities/admin-user.entity';
import { IAdminUser } from '../../../common/interfaces/admin-user.interface';
import { Reward, RewardDocument } from 'src/modules/rewards/entities/reward.entity';
import { IReward } from '../../interfaces/reward.interface'
import { DeliveryOrder, DeliveryOrderDocument } from 'src/modules/delivery/entities/delivery-order.entity';
import { IDeliveryOrder } from 'src/modules/delivery/interfaces/delivery-order.interface';
import { IActionLogs } from 'src/common/interfaces/action-log.interface';
import { ActionLogs, ActionLogsDocument } from '../entities/actionLog.entity';
import { RewardTransactionLog, RewardTransactionLogDocument } from '../entities/reward-transaction-log.entity';
import { IRewardTransactionLog } from '../../interfaces/reward.interface';
import { Coupon, CouponDocument } from '../../../modules/coupons/entity/coupons.entity';
import { ICoupon, ICouponLogs } from '../../../common/interfaces/coupons.interface';
import { CouponLogsDocument, CouponsLogs } from 'src/modules/coupons/entity/coupons-logs.entity';
import { PrintJob, PrintJobDocument } from '../entities/print-job.entity';
import { Restaurant } from '../entities/restaurant.entity';
import { Branch, BranchDocument } from '../entities/branch.entity';
import { IBranchs } from 'src/common/interfaces/common.interface';
import { IRestaurant } from 'src/common/interfaces/common.interface';
import { RestaurantDocument } from '../entities/restaurant.entity';
import { Review, ReviewDocument } from '../../../modules/reviews/entities/review.entity';
import { IReview } from '../../interfaces/review.interface';
import { ReviewVisibility, ReviewVisibilityDocument } from '../../../modules/reviews/entities/review-visibility.entity';
import { IReviewVisibility } from '../../interfaces/review-visibility.interface';
import { Lead, LeadDocument } from '../../../modules/leads/entity/lead.entity';
import { ILead } from '../../interfaces/leads.interface';
import { OtpSessions, OtpSessionsDocument } from 'src/modules/auth/entity/otp-sessions.entity';
import { IOtpSessions } from 'src/common/interfaces/otp-sessions.interface';
import { UserAnalyticsMv, UserAnalyticsMvDocument } from '../entities/user-analytics-mv.entity';


@Injectable()
export class MongoDBServices implements IMongoDBServices, OnApplicationBootstrap {
  user: IMongoRepository<User, IUser, UserDocument>;
  cart: IMongoRepository<Cart, ICart, CartDocument>;
  coupon: IMongoRepository<Coupon, ICoupon, CouponDocument>;
  couponlog: IMongoRepository<CouponsLogs, ICouponLogs, CouponLogsDocument>;
  order: IMongoRepository<Order, IOrder, OrderDocument>;
  address: IMongoRepository<Address, IAddress, AddressDocument>;
  adminUser: IMongoRepository<AdminUser, IAdminUser, AdminUserDocument>;
  lead: IMongoRepository<Lead, ILead, LeadDocument>;
  reward: IMongoRepository<Reward, IReward, RewardDocument>;
  deliveryOrder: IMongoRepository<DeliveryOrderDocument, IDeliveryOrder, IDeliveryOrder>;
  actionLogs: IMongoRepository<ActionLogs, IActionLogs, ActionLogsDocument>;
  rewardTransactionLog: IMongoRepository<RewardTransactionLog, IRewardTransactionLog, RewardTransactionLogDocument>;
  printJob: IMongoRepository<PrintJob, any, PrintJobDocument>;
  restaurant: IMongoRepository<Restaurant, IRestaurant, RestaurantDocument>;
  branch: IMongoRepository<Branch, IBranchs, BranchDocument>;
  review: IMongoRepository<Review, IReview, ReviewDocument>;
  reviewVisibility: IMongoRepository<ReviewVisibility, IReviewVisibility, ReviewVisibilityDocument>;
  otpSessions: IMongoRepository<OtpSessions, IOtpSessions, OtpSessionsDocument>;
  userAnalyticsMv: IMongoRepository<UserAnalyticsMv, any, UserAnalyticsMvDocument>;
  constructor(
    @InjectModel(User.name) private UserRepository: Model<User>,
    @InjectModel(Cart.name) private CartRepository: Model<Cart>,
    @InjectModel(Coupon.name) private CouponRepository: Model<Coupon>,
    @InjectModel(CouponsLogs.name) private CouponLogsRepository: Model<CouponsLogs>,
    @InjectModel(Order.name) private OrderRepository: Model<Order>,
    @InjectModel(Address.name) private AddressRepository: Model<Address>,
    @InjectModel(AdminUser.name) private AdminUserRepository: Model<AdminUser>,
    @InjectModel(Lead.name) private LeadRepository: Model<Lead>,
    @InjectModel(Reward.name) private RewardRepository: Model<Reward>,
    @InjectModel(DeliveryOrder.name) private DeliveryOrderRepository: Model<DeliveryOrder>,
    @InjectModel(ActionLogs.name) private ActionLogsRepository: Model<ActionLogsDocument>,
    @InjectModel(RewardTransactionLog.name) private RewardTransactionLogRepository: Model<RewardTransactionLogDocument>,
    @InjectModel(PrintJob.name) private PrintJobRepository: Model<PrintJob>,
    @InjectModel(Restaurant.name) private RestaurantRepository: Model<Restaurant>,
    @InjectModel(Branch.name) private BranchRepository: Model<Branch>,
    @InjectModel(Review.name) private ReviewRepository: Model<Review>,
    @InjectModel(ReviewVisibility.name) private ReviewVisibilityRepository: Model<ReviewVisibilityDocument>,
    @InjectModel(OtpSessions.name) private OtpSessionsRepository: Model<OtpSessionsDocument>,
    @InjectModel(UserAnalyticsMv.name) private UserAnalyticsMvRepository: Model<UserAnalyticsMvDocument>,
  ) {
    console.log('MongoDBServices loaded');
  }

  onApplicationBootstrap() {
    this.user = new MongoRepository<User, IUser, UserDocument>(this.UserRepository,);
    this.cart = new MongoRepository<Cart, ICart, CartDocument>(this.CartRepository,);
    this.coupon = new MongoRepository<Coupon, ICoupon, CouponDocument>(this.CouponRepository,);
    this.couponlog = new MongoRepository<CouponsLogs, ICouponLogs, CouponLogsDocument>(this.CouponLogsRepository,);
    this.order = new MongoRepository<Order, IOrder, OrderDocument>(this.OrderRepository,);
    this.address = new MongoRepository<Address, IAddress, AddressDocument>(this.AddressRepository,);
    this.address = new MongoRepository<Address, IAddress, AddressDocument>(this.AddressRepository,);
    this.adminUser = new MongoRepository<AdminUser, IAdminUser, AdminUserDocument>(this.AdminUserRepository,);
    this.lead = new MongoRepository<Lead, ILead, LeadDocument>(this.LeadRepository,);
    this.reward = new MongoRepository<Reward, IReward, RewardDocument>(this.RewardRepository,);
    this.deliveryOrder = new MongoRepository<DeliveryOrderDocument, IDeliveryOrder, IDeliveryOrder>(this.DeliveryOrderRepository,);
    this.actionLogs = new MongoRepository<ActionLogs, IActionLogs, ActionLogsDocument>(this.ActionLogsRepository);
    this.rewardTransactionLog = new MongoRepository<RewardTransactionLog, IRewardTransactionLog, RewardTransactionLogDocument>(this.RewardTransactionLogRepository);
    this.printJob = new MongoRepository<PrintJob, any, PrintJobDocument>(this.PrintJobRepository,);
    this.actionLogs = new MongoRepository<ActionLogs, IActionLogs, ActionLogsDocument>(this.ActionLogsRepository,);
    this.restaurant = new MongoRepository<Restaurant, IRestaurant, RestaurantDocument>(this.RestaurantRepository,);
    this.branch = new MongoRepository<Branch, IBranchs, BranchDocument>(this.BranchRepository,);
    this.review = new MongoRepository<Review, IReview, ReviewDocument>(this.ReviewRepository,);
    this.reviewVisibility = new MongoRepository<ReviewVisibility, IReviewVisibility, ReviewVisibilityDocument>(this.ReviewVisibilityRepository,);
    this.otpSessions = new MongoRepository<OtpSessions, IOtpSessions, OtpSessionsDocument>(this.OtpSessionsRepository,);
    this.userAnalyticsMv = new MongoRepository<UserAnalyticsMv, any, UserAnalyticsMvDocument>(this.UserAnalyticsMvRepository,);
    console.log('<== Mongo DB repositories got initialised ==>');
  }
} 
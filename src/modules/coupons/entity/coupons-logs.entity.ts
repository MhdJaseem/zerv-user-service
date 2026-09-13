import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ICouponLogs } from '../../../common/interfaces/coupons.interface';
import { nanoid } from 'nanoid';
import { CouponRedeemedStatus } from '../../../common/enums/cart.enum';

export type CouponLogsDocument = CouponsLogs & Document;

@Schema({ timestamps: true })
export class CouponsLogs extends Document implements ICouponLogs {
  @Prop({
    required: true,
    unique: true,
    default: () => nanoid(),
  })
  couponLogsId: string;

  @Prop({ required: false })
  couponId: string;

  @Prop({ required: false })
  couponCode: string;

  @Prop({ required: false })
  discountValue: number;
  
  @Prop({ required: true })
  expiryDate: string;
  
  @Prop({ required: true })
  userId: string;

  @Prop({ required: false })
  orderId?: string;

  @Prop({ required: true })
  branchId: string;

  @Prop({ required: true })
  couponDiscountAmount: number;

  @Prop({ required: false })
  maxRedemptions?: number;

  @Prop({ type: String, enum: CouponRedeemedStatus, default: CouponRedeemedStatus.PENDING })
  redeemedStatus: CouponRedeemedStatus;
}

export const CouponsLogsSchema = SchemaFactory.createForClass(CouponsLogs);

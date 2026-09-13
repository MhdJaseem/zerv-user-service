import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ICoupon } from '../../../common/interfaces/coupons.interface';
import { nanoid } from 'nanoid';

export type CouponDocument = Coupon & Document;

@Schema({ timestamps: true })
export class Coupon extends Document implements ICoupon {
  @Prop({
    required: true,
    unique: true,
    default: () => nanoid(),
  })
  couponId: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: false })
  description: string;

  @Prop({ type: String, required: true })
  couponCode: string;

  @Prop({ type: String, required: true })
  branchId: string;
  
  @Prop({ type: String, required: false })
  targetProductId?: string; // For BOGO: the product eligible for the offer

  @Prop({ type: String, required: true })
  discountType: string;

  @Prop({ type: Number, required: false })
  discountValue: number;

  @Prop({ type: Date, required: false })
  expiryDate: Date;

  @Prop({ type: Number, required: false })
  maxDiscountAmount: number;

  @Prop({ type: Number, required: false })
  minOrderAmount: number;

  @Prop({ type: Number, required: false })
  maxRedemptions: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

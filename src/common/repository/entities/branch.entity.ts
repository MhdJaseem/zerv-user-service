import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  IBranchs,
  IHours,
  ILocation,
  ICuisineType,
  IStripeInfo,
  IUberInfo,
  IAdloggsInfo,
  IRazorpayInfo,
  IEntranceModal
} from '../../../common/interfaces/common.interface';
import { nanoid } from 'nanoid';

export type BranchDocument = Branch & Document;

export class stripeInfo implements IStripeInfo {
  @Prop({ required: true })
  stripeAccountId: string;

  @Prop({ required: true, default: false })
  stripeEnabled: boolean;

  @Prop()
  stripeOnboardingUrl: string;
}

export class uberInfo implements IUberInfo {
  @Prop({ required: true })
  uberClientId: string;

  @Prop({ required: true })
  uberClientSecret: string;

  @Prop({ required: true })
  uberCustomerId: string;

  @Prop({ required: true, default: false })
  uberEnabled: boolean;

}

export class adloggsInfo implements IAdloggsInfo {
  @Prop({ required: true })
  adloggsApiKey: string;

  @Prop({ required: true, default: false })
  adloggsEnabled: boolean;

  @Prop()
  adloggsPartnerMerchantId?: string;
}

export class razorpayInfo implements IRazorpayInfo {
  @Prop({ type: String, index: true })
  razorpaySubscriptionId?: string;

  @Prop({ type: String })
  razorpayPlanId?: string;

  @Prop({ type: String })
  rpyConnectedAcctId?: string;

  @Prop({ type: String })
  razorpayCustomerId?: string;

  @Prop({
    type: String,
    enum: ['CREATED', 'ACTIVE', 'PAST_DUE', 'INACTIVE', 'CANCELLED', 'PAUSED', 'AUTHENTICATED'],
    index: true
  })
  subscriptionStatus?: 'CREATED' | 'ACTIVE' | 'PAST_DUE' | 'INACTIVE' | 'CANCELLED' | 'PAUSED' | 'AUTHENTICATED';

  @Prop({ type: Date })
  subscriptionCurrentPeriodStart?: Date;

  @Prop({ type: Date })
  subscriptionCurrentPeriodEnd?: Date;

  @Prop({ type: Date })
  subscriptionChargeAt?: Date;

  @Prop({ type: Date })
  subscriptionCancelledAt?: Date;

  @Prop({ type: Date })
  subscriptionPausedAt?: Date;
}

export class Location extends Document {
  @Prop({
    type: String,
    enum: ['Point'],
    required: true,
  })
  type: string;

  @Prop({
    type: [Number, Number],
    required: true,
  })
  coordinates: number[];
}

@Schema({
  timestamps: true
})
export class Branch extends Document implements IBranchs {
  @Prop({ required: true, unique: true, default: () => nanoid(18) })
  branchId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  restaurantId: string;

  @Prop({ required: true })
  address: string;

  @Prop({ type: Location })
  location: ILocation;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  email: string;


  @Prop({ required: true })
  timezone: string;

  @Prop({ default: 5 })
  taxRate?: number;

  @Prop({ type: [{ type: Object }] })
  cuisineType: ICuisineType[];

  @Prop({ type: Object })
  hours: {
    pickupToggle: boolean;
    deliveryToggle: boolean;
    storeHours: IHours[];
    pickupHours: IHours[];
    deliveryHours: IHours[];
  };

  @Prop({ type: Number, required: true })
  preparationTimeInMins: number;

  @Prop({ type: Number, default: 5 })
  deliveryRadiusKm?: number;

  @Prop({ type: Boolean, default: true })
  autoAcceptOrder: boolean;

  @Prop({ type: Boolean })
  isDeleted: boolean;

  @Prop({ type: stripeInfo, required: false })
  stripeInfo: stripeInfo;

  @Prop({ type: uberInfo })
  uberInfo: uberInfo;

  @Prop({ type: adloggsInfo })
  adloggsInfo: adloggsInfo;

  @Prop({ type: razorpayInfo })
  razorpayInfo: razorpayInfo;

  @Prop({ type: Object })
  entranceModal: IEntranceModal;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ location: '2dsphere' });
BranchSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: 1 });
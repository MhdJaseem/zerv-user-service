import { nanoid } from 'nanoid';
import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { IContactInfo, IRestaurant, IRestaurantAddresses, IStripeInfo } from '../../../common/interfaces/common.interface';

export type RestaurantDocument = Restaurant & Document;

class RestaurantAddresses implements IRestaurantAddresses {
  @Prop({ required: true })
  line1: string;
  @Prop({ required: true })
  line2: string;
  @Prop({ required: true })
  city: string;
  @Prop({ required: true })
  state: string;
  @Prop({ required: true })
  postalCode: string;
  @Prop({ required: true })
  countryCode: string;
}


export class ContactInfo implements IContactInfo {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  url: string;
}

export class stripeInfo implements IStripeInfo {
  @Prop({ required: true })
  stripeAccountId: string;

  @Prop({ required: true, default: false })
  stripeEnabled: boolean;

  @Prop({ required: false })
  stripeOnboardingUrl: string;

  @Prop({ required: true, default: false })
  uberEnabled: boolean;
}

@Schema({ timestamps: true })
export class Restaurant extends Document implements IRestaurant {

  @Prop({ type: RestaurantAddresses, required: true })
  address: IRestaurantAddresses;

  @Prop({ required: true, unique: true, default: () => nanoid() })
  restaurantId: string;

  @Prop({ required: true, unique: true })
  restaurantName: string;

  @Prop({ required: true })
  restaurantOriginUrl: string[];

  @Prop({ type: ContactInfo, required: true })
  contactInfo: ContactInfo;

  @Prop({ type: stripeInfo, required: false })
  stripeInfo: stripeInfo;

  @Prop({ required: true, default: false })
  isDeleted: boolean;

  @Prop({ required: false, default: false })
  isCateringEnabled?: boolean;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);

// Used heavily in analytics onboarding + lookups
RestaurantSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: 1 });
RestaurantSchema.index({ isDeleted: 1, createdAt: 1 });
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid, customAlphabet } from 'nanoid';
import { IOrder, ICartItemO, ILocation } from '../../../common/interfaces/order.interface';
import { OrderStatus, OrderTypeEnum } from '../../../common/enums/user.enum';
import { ALPHABET } from '../../../common/constants/common.constants';
export type OrderDocument = Order & Document;


export class ModifierOption {
  @Prop({ type: String })
  optionId: string;

  @Prop({ type: String })
  optionName: string;
}
export class ModifierGroup {
  @Prop({ type: String })
  modifierGroupId: string;

  @Prop({ type: String })
  modifierGroupName: string;

  @Prop({ type: [String] })
  options: ModifierOption[];
}

export class CartItem implements ICartItemO {
  @Prop({ type: String, required: true })
  productId: string;

  @Prop({ type: String, required: true })
  productName: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop()
  imageUrl?: string;

  @Prop({ type: [String], required: false })
  modifierGroupId: ModifierGroup[];

  @Prop({ type: String, required: false })
  specialInstructions?: string;
}

export class OrderTime {
  @Prop({ type: String, required: true })
  from: string;

  @Prop({ type: String, required: true })
  to: string;
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

export class AddressDetails {
  @Prop({ type: [String], required: true })
  streetAddress: string[];

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true })
  zipCode: string;

  @Prop({ type: String, required: true, default: 'US' })
  country: string;

  @Prop({ type: Location })
  location: ILocation;
}

@Schema({ timestamps: true })
export class Order extends Document implements IOrder {
  @Prop({
    required: true,
    unique: true,
    default: () => nanoid(),
  })
  orderId: string;

  @Prop({
    required: true,
    type: String
  })
  restaurantId: string;

  @Prop({
    required: true,
    type: Date
  })
  orderDate: Date;

  @Prop({
    required: true,
    type: OrderTime
  })
  orderTime: OrderTime;

  @Prop({
    required: true,
    enum: OrderStatus
  })
  orderStatus: OrderStatus;

  @Prop({
    required: true,
    enum: OrderTypeEnum
  })
  orderType: OrderTypeEnum;

  @Prop({ required: true })
  items: ICartItemO[];

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  branchId: string;

  @Prop({ type: AddressDetails })
  address?: AddressDetails;

  @Prop({ type: Number, default: 0 })
  pointsToAdd: number;

  @Prop({ type: Number, default: 0 })
  pointsToBeRedeemed: number;

  @Prop({ type: Number, default: 0 })
  totalPointsToBeAdded: number;

  @Prop({ type: Boolean})
  includeUtensils: boolean;

  @Prop({ type: Boolean})
  getPromotionalEmails: boolean;

  @Prop({ type: Boolean})
  getPromotionalTexts: boolean;

  @Prop({ type: String})
  specialInstruction: string;

  @Prop({ type: String })
  paymentId: string;

  @Prop({ type: Number })
  amount:number

  @Prop({ type: String })
  deliveryOrderId?: string;

  @Prop({ type: Number, default: 0 })
  deliveryTipAmount: number;

  @Prop({ type: Number, default: 0})
  platformFee: number;

  @Prop({ type: Number})
  deliveryFee: number;

  @Prop({ type: Number, default: 0 })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  taxes: number;

  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Object, default: {} })
  customerInfo: {
    name: string;
    phoneNumber: string;
    email: string;
  };

  @Prop({ type: Location })
  location: ILocation;

  @Prop({ type: String })
  couponCode?: string;

  @Prop({ type: Number, default: 0 })
  couponDiscountAmount?: number;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Analytics-heavy access patterns:
// - filter by restaurantId (+ optional orderDate range) and group by branchId / orderStatus
OrderSchema.index({ restaurantId: 1, orderDate: 1, orderStatus: 1, branchId: 1 });
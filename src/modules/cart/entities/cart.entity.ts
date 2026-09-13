import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';
import { ICart, ICartItem, ICustomerInfo } from '../../../common/interfaces/cart.interface';
import { OrderTypeEnum } from '../../../common/enums/user.enum';
import { DeliveryLocationDto } from '../dto/create-cart.dto';

export type CartDocument = Cart & Document;

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

export class CartItem implements ICartItem {
  @Prop({ type: String, required: true })
  productId: string;

  @Prop({ type: String, required: true })
  productName: string;

  @Prop({ type: String })
  cartItemId: string;
  
  @Prop({ type: String })
  description: string;

  @Prop({ type: String })
  imageUrl: string;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true })
  pointsToAdd: number;

  @Prop({ type: Number, required: true })
  pointsToRedeem: number;

  @Prop({ type: [String], required: false })
  modifierGroupId: ModifierGroup[];

  @Prop({ type: Boolean, required: false })
  IsAddedFromRewards:boolean

  @Prop({ type: String, required: false })
  specialInstructions?: string;
}

export class OrderTime {
  @Prop({ type: String, required: true })
  from: string;

  @Prop({ type: String, required: true })
  to: string;
}


@Schema({ timestamps: true })
export class Cart extends Document implements ICart {
  @Prop({ type: String, unique: true, default: () => nanoid() })
  cartId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  branchId: string;

  @Prop({ required: true, enum: OrderTypeEnum })
  orderType: OrderTypeEnum;

  @Prop({ required: true })
  items: CartItem[];

  @Prop({ type: Number, default: 0 })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  taxes: number;

  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Number, default: 0 })
  roundOff: number;

  @Prop({ type: DeliveryLocationDto })
  address: DeliveryLocationDto;

  @Prop({ type: Number, default: 0 })
  deliveryTipAmount: number;

  @Prop({ type: String, required: true })
  restaurantId: string;

  @Prop({ type: Boolean })
  includeUtensils: boolean;

  @Prop({
    type: String
  })
  orderDate: string;

  @Prop({
    type: OrderTime
  })
  orderTime: OrderTime;

  @Prop({ type: String })
  specialInstruction: string;

  @Prop({ type: Number, default: 0 })
  pointsToBeRedeemed: number;

  @Prop({ type: Number, default: 0 })
  totalPointsToBeAdded: number;

  @Prop({ type: Number, default: 0 })
  platformFee: number;

  @Prop({ type: Number })
  deliveryFee: number;

  @Prop({ type: Boolean, default: true })
  getPromotionalEmails: boolean;

  @Prop({ type: Boolean, default: false })
  getPromotionalTexts: boolean;

  @Prop({ type: String, required: false })
  couponId: string;

  @Prop({ type: String, required: false })
  couponCode: string;

  @Prop({ type: Number, default: 0 })
  couponDiscountAmount: number;

  @Prop({ type: Date, required: false })
  couponExpiryDate: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart); 
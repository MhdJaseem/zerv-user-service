import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';
import { DeliveryStatus, DeliveryProviderEnum } from '../../../common/enums/delivery.enum';
import { IDeliveryOrder } from '../interfaces/delivery-order.interface';

export type DeliveryOrderDocument = DeliveryOrder & Document;

class Address {
  @Prop({ type: String, required: true })
  streetAddress: string;

  @Prop({ type: String })
  apartment?: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  zipCode: string;

  @Prop({ type: Number, required: true })
  latitude: number;

  @Prop({ type: Number, required: true })
  longitude: number;
}

class DriverDetails {
  @Prop({ type: String })
  name?: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  tracking_url?: string;
}

@Schema({ timestamps: true })
export class DeliveryOrder extends Document implements IDeliveryOrder {
  @Prop({
    required: true,
    unique: true,
    default: () => nanoid()
  })
  deliveryId: string;

  @Prop({
    required: true,
    type: String
  })
  orderId: string;

  @Prop({
    required: true,
    type: String
  })
  userId: string;

  @Prop({
    required: true,
    type: String
  })
  restaurantId: string;

  @Prop({
    required: true,
    type: String
  })
  branchId: string;

  @Prop({
    required: true,
    enum: DeliveryProviderEnum,
    type: String
  })
  provider: DeliveryProviderEnum;

  @Prop({
    type: String
  })
  providerOrderId?: string;

  @Prop({
    required: true,
    enum: DeliveryStatus,
    default: DeliveryStatus.CREATED
  })
  status: DeliveryStatus;

  @Prop({
    required: true,
    type: Address
  })
  pickupAddress: Address;

  @Prop({
    required: true,
    type: Address
  })
  deliveryAddress: Address;

  @Prop({
    type: Date
  })
  estimatedPickupTime?: Date;

  @Prop({
    type: Date
  })
  estimatedDeliveryTime?: Date;

  @Prop({
    type: Date
  })
  actualPickupTime?: Date;

  @Prop({
    type: Date
  })
  actualDeliveryTime?: Date;

  @Prop({
    type: Number
  })
  deliveryFee?: number;

  @Prop({
    type: Number
  })
  deliveryTipAmount?: number;

  @Prop({
    type: DriverDetails
  })
  driverDetails?: DriverDetails;

  @Prop({
    type: Object
  })
  providerResponse?: any;

  @Prop({
    type: Date
  })
  createdAt: Date;

  @Prop({
    type: Date
  })
  updatedAt: Date;

  @Prop({
    type: Number
  })
  orderAmount: number;

  @Prop({
    type: String
  })
  branchName: string;

  @Prop({
    type: String
  })
  branchTimeZone: string;

  @Prop({
    type: String
  })
  branchPhone: string;
}

export const DeliveryOrderSchema = SchemaFactory.createForClass(DeliveryOrder);

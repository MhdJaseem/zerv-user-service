import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReviewDocument = Review & Document;

export enum ReviewTargetType {
  RESTAURANT = 'restaurant',
  MENU_ITEM = 'menu_item',
  DELIVERY_PARTNER = 'delivery_partner',
}

@Schema({ timestamps: true })
export class Review {
  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: ReviewTargetType })
  targetType: ReviewTargetType;

  @Prop({ required: true })
  targetId: string; // restaurantId, productId, or riderId

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop()
  comment: string;

  @Prop({ type: Boolean, default: false })
  isVisible: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Index for faster queries on targets and averages
ReviewSchema.index({ targetId: 1, targetType: 1 });
ReviewSchema.index({ orderId: 1, userId: 1, targetId: 1, targetType: 1 }, { unique: true });

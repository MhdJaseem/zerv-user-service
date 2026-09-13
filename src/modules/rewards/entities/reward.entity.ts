import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';

export type RewardDocument = Reward & Document;

@Schema({ timestamps: true })
export class Reward extends Document {
  @Prop({ required: true, unique: true, default: () => nanoid() })
  rewardId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  rewardPoints: number;

  @Prop({ required: true })
  restaurantId: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const RewardSchema = SchemaFactory.createForClass(Reward);
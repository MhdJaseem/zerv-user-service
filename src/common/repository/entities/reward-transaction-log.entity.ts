import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IRewardTransactionLog } from '../../interfaces/reward.interface';
import { RewardAdjustmentTypes } from 'src/common/enums/reward.enum';

export type RewardTransactionLogDocument = RewardTransactionLog & Document;

@Schema({ timestamps: true })
export class RewardTransactionLog implements IRewardTransactionLog {
  @Prop({ required: true })
  userId: string;

  @Prop()
  adjustType: RewardAdjustmentTypes;

  @Prop()
  quantity: number;

  @Prop()
  reason: string;

  @Prop()
  adjustedBy: string;

  @Prop()
  restaurantId: string;

  @Prop()
  orderId: string;
}

export const RewardTransactionLogSchema =
  SchemaFactory.createForClass(RewardTransactionLog);

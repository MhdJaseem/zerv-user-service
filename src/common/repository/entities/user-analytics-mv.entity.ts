import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserAnalyticsMvDocument = UserAnalyticsMv & Document;

@Schema({ timestamps: true, collection: 'user_analytics_mv' })
export class UserAnalyticsMv extends Document {
  @Prop({ type: String, required: true, unique: true, index: true })
  cacheKey: string;

  @Prop({ type: Date, required: true, index: true })
  computedAt: Date;

  @Prop({ type: Date, required: true, index: true })
  expiresAt: Date;

  @Prop({ type: Object, required: true })
  payload: any;
}

export const UserAnalyticsMvSchema = SchemaFactory.createForClass(UserAnalyticsMv);

// Optional TTL cleanup; keep docs only until expiresAt.
UserAnalyticsMvSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


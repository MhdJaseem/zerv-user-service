import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IReviewVisibility } from 'src/common/interfaces/review-visibility.interface';

export type ReviewVisibilityDocument = ReviewVisibility & Document;

@Schema({ timestamps: true })
export class ReviewVisibility extends Document implements IReviewVisibility {
  @Prop({ type: Boolean, default: true })
  isShowReview: boolean;

  @Prop({ type: String, required: true, unique: true, default: 'global' })
  visibilityId: string;
}

export const ReviewVisibilitySchema = SchemaFactory.createForClass(ReviewVisibility);

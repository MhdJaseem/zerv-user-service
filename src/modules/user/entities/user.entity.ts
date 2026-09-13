import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';
import { UserTypeEnum } from 'src/common/enums/user.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true, default: () => nanoid() })
  userId: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: false })
  phoneNumber: string;

  @Prop({ required: true })
  userType: UserTypeEnum;

  @Prop()
  birthday: Date;

  @Prop({ required: true })
  restaurantId: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Boolean, default: true })
  getPromotionalEmails: boolean;

  @Prop({ type: Boolean, default: true })
  getPromotionalTexts: boolean;

  @Prop({ type: String })
  otp: string;

  @Prop({ type: String, required: false, default: 'email' })
  authProvider?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: 1 });
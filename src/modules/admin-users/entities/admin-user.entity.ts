import { nanoid } from 'nanoid';
import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { CollectionNames } from 'src/common/enums/common.enum';
import { IAdminUser } from 'src/common/interfaces/admin-user.interface';

export type AdminUserDocument = AdminUser & Document;

@Schema({ timestamps: true, collection: CollectionNames.ADMIN_USERS })
export class AdminUser extends Document implements IAdminUser {
  @Prop({ required: true, unique: true, default: () => nanoid() })
  adminId: string;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, required: true })
  phoneNumber: string;

  @Prop({ type: String })
  role: string;

  @Prop({ type: Array<Object> })
  abilities: {
    attributeName: string;
    attributeAccess: string[];
  }[];

  @Prop({ type: String })
  refreshToken?: string;

  @Prop({ type: String })
  restaurantId: string;

  @Prop({ type: [String] })
  branchId?: string[];

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: String, required: true })
  authProvider: string;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);

AdminUserSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: 1 });


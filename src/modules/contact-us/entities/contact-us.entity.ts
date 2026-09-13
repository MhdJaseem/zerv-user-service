import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';

export enum ContactUsStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class ContactUs extends Document {
  @Prop({ default: () => nanoid() })
  ticketId: string;

  @Prop({ required: true })
  restaurantId: string;

  @Prop({ required: true })
  remarks: string;

  @Prop({ type: String, enum: ContactUsStatus, default: ContactUsStatus.PENDING })
  status: ContactUsStatus;

  @Prop({ type: String, required: false })
  adminNotes?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export type ContactUsDocument = ContactUs & Document;
export const ContactUsSchema = SchemaFactory.createForClass(ContactUs);

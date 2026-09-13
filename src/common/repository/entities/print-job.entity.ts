import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PrintJobDocument = PrintJob & Document;

export type PrintJobStatus = 'queued' | 'printed' | 'failed';

@Schema({ timestamps: true })
export class PrintJob extends Document {
  @Prop({ required: true })
  restaurantId: string;

  @Prop({ required: true })
  branchId: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ type: String, enum: ['queued', 'printed', 'failed'], default: 'queued' })
  status: PrintJobStatus;

  @Prop({ type: Date, required: false })
  expiresAt?: Date; // TTL cleanup

  @Prop({ type: String, required: false })
  lastError?: string;
}

export const PrintJobSchema = SchemaFactory.createForClass(PrintJob);
PrintJobSchema.index({ branchId: 1, status: 1, createdAt: 1 });
PrintJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });



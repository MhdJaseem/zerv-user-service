import { nanoid } from "nanoid";
import { Document } from "mongoose";
import { LeadStatus } from "src/common/enums/leads.enum";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ timestamps: true, collection: 'leads' })
export class Lead extends Document {
    @Prop({ required: true, unique: true, default: () => nanoid(16) })
    leadId: string;

    @Prop({ type: String, required: false, trim: true })
    firstName: string;

    @Prop({ type: String, required: false, trim: true })
    lastName?: string;

    @Prop({ type: String, required: true, trim: true, unique: true })
    email: string;

    @Prop({ type: String, required: true, trim: true })
    password: string;

    @Prop({ type: String, required: true, trim: true })
    phoneNumber: string;

    @Prop({ type: String })
    role: string;

    @Prop({ type: String, enum: LeadStatus, required: true, default: LeadStatus.PENDING })
    leadStatus: LeadStatus;

    @Prop({ type: Array<Object> })
    abilities: {
        attributeName: string;
        attributeAccess: string[];
    }[];

    @Prop({ type: String })
    refreshToken?: string;

    @Prop({ type: String, required: false })
    restaurantId?: string;

    @Prop({ type: Boolean, default: false })
    isEmailVerified: boolean

    @Prop({ type: String, required: false })
    branchId?: string;

    @Prop({ type: Boolean, default: false })
    isDeleted: boolean;

    @Prop({ type: Date, required: false })
    trialStartAt?: Date;

    @Prop({ type: Date, required: false })
    trialEndsAt?: Date;

    @Prop({ type: Date, required: false })
    convertedAt?: Date;

    @Prop({ type: Date, required: false })
    expiredAt?: Date;

    @Prop({ type: String, required: false })
    authProvider?: string;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

export type LeadDocument = Lead & Document;
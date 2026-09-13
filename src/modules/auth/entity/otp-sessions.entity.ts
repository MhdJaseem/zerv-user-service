import { nanoid } from "nanoid";
import { Document } from "mongoose";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { IOtpSessions } from "src/common/interfaces/otp-sessions.interface";

export type OtpSessionsDocument = OtpSessions & Document;

@Schema({ timestamps: true, collection: 'otpsessions' })
export class OtpSessions extends Document implements IOtpSessions {
    @Prop({ required: true, unique: true, default: () => nanoid() })
    otpSessionId: string;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true, unique: true })
    otpCode: string;

    @Prop({ required: true })
    expiresAt: Date;
}

export const OtpSessionsSchema = SchemaFactory.createForClass(OtpSessions);
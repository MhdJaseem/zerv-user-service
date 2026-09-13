import { Prop } from "@nestjs/mongoose";
import { Document } from 'mongoose';
import { IsEmail } from "class-validator";

export interface IModifier {
    entityType?: string;
    entityId?: string;
    entityName?: string;
    entityEmailId?: string; // In case of admin we storing the email
}

export class Modifier extends Document {
    @Prop({ type: String })
    entityType: string;

    @Prop({ required: false })
    entityId: string;

    /* Admin user will be having User mail ID */
    @Prop({ required: false })
    @IsEmail({}, { message: 'Invalid email format' })
    entityEmailId?: string;

    @Prop({ required: false })
    entityName: string;
}
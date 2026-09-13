import { LeadStatus } from "../enums/leads.enum";

export interface ILead {
    leadId: string;
    firstName: string;
    lastName?: string;
    email: string;
    password: string;
    phoneNumber: string;
    restaurantId?: string;
    branchId?: string;
    leadStatus: LeadStatus;
    role?: string;
    abilities?: {
        attributeName: string;
        attributeAccess: string[];
    }[];
    refreshToken?: string;
    isEmailVerified: boolean;
    authProvider?: string;
    trialStartAt?: Date;
    trialEndsAt?: Date;
    convertedAt?: Date;
    expiredAt?: Date;
    isDeleted?: boolean;
}
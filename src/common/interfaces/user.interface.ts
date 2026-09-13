import { UserTypeEnum } from "../enums/user.enum";

export interface IUser {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  userType: UserTypeEnum;
  birthday?: Date;
  restaurantId: string;
  isDeleted?: boolean;
  getPromotionalEmails?: boolean;
  getPromotionalTexts?: boolean;
  otp?: string;
  otpExpiry?: Date;
  isEmailVerified?: boolean;
  authProvider?: string;
} 
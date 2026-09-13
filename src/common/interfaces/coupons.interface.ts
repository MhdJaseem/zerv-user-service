import { CouponRedeemedStatus } from "../enums/cart.enum";

export interface ICoupon {
  couponId: string;
  title: string;
  description?: string;
  couponCode: string;
  branchId: string;
  discountType: string;
  expiryDate: Date;
  maxDiscountAmount: number;
  isActive: boolean;
  discountValue: number;
  targetProductId?: string; // For BOGO: the product eligible for the offer
}

export interface ICouponLogs {
  couponLogsId: string;
  couponCode: string;
  couponDiscountAmount: number;
  expiryDate: string;
  userId: string;
  branchId: string;
  orderId?: string;
  redeemedStatus: CouponRedeemedStatus;
  maxRedemptions?: number;
}


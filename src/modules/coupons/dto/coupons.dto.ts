import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDate, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { nanoid } from 'nanoid';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  couponCode: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  discountType: string;

  @IsNumber()
  @IsOptional()
  maxDiscountAmount: number;

  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  expiryDate: Date;   

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  discountValue: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minOrderAmount: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxRedemptions: number;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive: boolean;

  @IsString()
  @IsOptional()
  targetProductId?: string; // For BOGO: the product eligible for the offer
}

export class CreateCouponLogsDto {
  @IsString()
  @IsNotEmpty()
  couponCode: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @Type(() => Boolean)
  @IsOptional()
  redeemed?: boolean = false;

  couponLogsId: string = nanoid();
}

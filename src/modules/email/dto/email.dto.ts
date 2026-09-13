import { IsString, IsEmail, IsOptional, IsNumber } from 'class-validator';

export class CreateEmailDto {}

export class SendOrderEmailDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsNumber()
  guests: number;

  @IsString()
  orderItems: string;

  @IsString()
  eventDate: string;

  @IsString()
  deliveryType: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  branchId: string;

  @IsString()
  branchName: string;
}
import { IsString, IsNotEmpty, IsOptional, IsPhoneNumber } from 'class-validator';

export class GenerateSmsOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  restaurantId: string;
}

export class VerifySmsOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsOptional()
  restaurantId: string;
}

export class ResendSmsOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  restaurantId: string;
}


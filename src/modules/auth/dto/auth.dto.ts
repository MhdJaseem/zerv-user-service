import { IsString, IsPhoneNumber, MinLength, IsOptional, IsNotEmpty } from 'class-validator';

export class VerifyOtpDto {

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsOptional()
  restaurantId?: string;
}

export class InitiateAuthDto {
  @IsPhoneNumber()
  phoneNumber: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
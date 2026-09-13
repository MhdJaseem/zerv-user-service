import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
export class CreateLeadOnboardingDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsOptional()
  @IsArray()
  abilities?: {
    attributeName: string;
    attributeAccess: string[];
  }[];

  @IsOptional()
  @IsString()
  restaurantId?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  /** Defaults to `email` when omitted (password onboarding). */
  @IsOptional()
  @IsString()
  authProvider?: string;
}

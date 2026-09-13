import { IsString, IsNotEmpty, IsOptional, MinLength, IsEmail, IsArray } from 'class-validator';

export class AdminUserDto {
  @IsString()
  @IsOptional()
  adminId: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail({}, { message: 'Invalid email address' })
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

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsString()
  @IsOptional()
  restaurantId: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  /** `email` for password signup; OAuth values match `IdentityType` (e.g. `google`). */
  @IsString()
  @IsOptional()
  authProvider?: string;
}
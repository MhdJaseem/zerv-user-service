import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsEnum, IsArray, IsNumber, ValidateNested, IsOptional, IsDate, IsBoolean } from 'class-validator';
import { IOrder, ICartItemO, ILocation } from '../../../common/interfaces/order.interface';
import { OrderStatus } from '../../../common/enums/user.enum';

class ModifierOptionDto {
  @IsString()
  @IsNotEmpty()
  optionId: string;

  @IsString()
  @IsOptional()
  optionName: string;
}

class ModifierGroupDto {
  @IsString()
  @IsNotEmpty()
  modifierGroupId: string;

  @IsString()
  @IsOptional()
  modifierGroupName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  options: ModifierOptionDto[];
}

class CartItemDto implements ICartItemO {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  productName: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsNumber()
  @IsOptional()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsOptional()
  modifierGroupId: ModifierGroupDto[];

  @IsString()
  @IsOptional()
  specialInstructions?: string;
}

export class CreateUser {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class LocationDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsArray()
  @IsNotEmpty()
  coordinates: number[];
}

export class Address {
  @IsString()
  @IsOptional()
  apartment?: string;

  @IsString()
  @IsNotEmpty()
  streetAddress: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

export class OrderTimeDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  restaurantId?: string;

  @IsString()
  @IsNotEmpty()
  orderDate: string;

  @ValidateNested()
  @Type(() => OrderTimeDto)
  @IsNotEmpty()
  orderTime: OrderTimeDto;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @ValidateNested()
  @Type(() => Address)
  @IsOptional()
  address: Address;

  @ValidateNested()
  @Type(() => CreateUser)
  @IsNotEmpty()
  customerInfo: CreateUser;

  @IsBoolean()
  @IsOptional()
  includeUtensils?: boolean;

  @IsBoolean()
  @IsOptional()
  getPromotionalEmails?: boolean;

  @IsBoolean()
  @IsOptional()
  getPromotionalTexts?: boolean;

  @IsString()
  @IsOptional()
  specialInstruction?: string;

  @IsNumber()
  @IsOptional()
  deliveryTipAmount?: number;

  @IsString()
  @IsOptional()
  couponId?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;
}

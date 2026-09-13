import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, ValidateNested, IsArray, IsBoolean, IsIn, IsObject } from 'class-validator';
import { ICart, ICartItem, ICustomerInfo, IModifierGroups, IModifierOptions } from '../../../common/interfaces/cart.interface';
import { OrderTypeEnum } from '../../../common/enums/user.enum';

export class LocationDto {
  @IsString()
  @IsIn(['Point'])
  type: string;
  @IsArray()
  coordinates: number[];
}

export class DeliveryLocationDto {
  @IsString()
  @IsOptional()
  apartment: string;

  @IsString()
  @IsOptional()
  streetAddress: string;

  @IsString()
  @IsOptional()
  city: string;
  
  @IsString()
  @IsOptional()
  zipCode: string;

  @IsObject()
  @IsOptional()
  @Type(() => LocationDto)
  @ValidateNested()
  location: LocationDto;

}

class OptionDto {
  @IsString()
  @IsNotEmpty()
  optionId: string;

  @IsString()
  @IsNotEmpty()
  optionName: string;

  @IsNumber()
  @IsNotEmpty()
  sequence:number;
}

class ModifierGroupDto {
  @IsString()
  @IsNotEmpty()
  modifierGroupId: string;

  @IsArray()
  options: OptionDto[];
}

class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  cartItemId: string;

  @IsString()
  @IsOptional()
  productName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierGroupDto)
  modifierGroups: ModifierGroupDto[];

  @IsBoolean()
  @IsOptional()
  IsAddedFromRewards:boolean;

  @IsString()
  @IsOptional()
  specialInstructions?: string;
}

class CustomerInfoDto implements ICustomerInfo {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  companyName?: string;
}

export class OrderTimeDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
}

export class CreateCartDto {
  @IsString()
  @IsOptional()
  cartId: string;

  @IsString()
  @IsOptional()
  userId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsEnum(OrderTypeEnum)
  @IsNotEmpty()
  orderType: OrderTypeEnum;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsArray()
  @IsOptional()
  modifierGroups?: IModifierGroups[];

  @IsNumber()
  @IsOptional()
  subtotal: number;

  @IsNumber()
  @IsOptional()
  taxes: number;

  @IsNumber()
  @IsOptional()
  total: number;

  @ValidateNested()
  @Type(() => CustomerInfoDto)
  @IsOptional()
  customerInfo?: CustomerInfoDto;

  @IsString()
  @IsOptional()
  addressId?: string;

  @IsNumber()
  @IsOptional()
  deliveryTipAmount: number;

  @IsString()
  @IsOptional()
  restaurantId?: string;

  @IsBoolean()
  @IsOptional()
  includeUtensils: boolean;

  @IsString()
  @IsOptional()
  specialInstruction: string;

  @IsString()
  @IsOptional()
  orderDate: string;

  @ValidateNested()
  @Type(() => OrderTimeDto)
  @IsOptional()
  orderTime: OrderTimeDto;

  @ValidateNested()
  @Type(() => DeliveryLocationDto)
  @IsOptional()
  address:DeliveryLocationDto

  @IsBoolean()
  @IsOptional()
  getPromotionalEmails?: boolean;

  @IsBoolean()
  @IsOptional()
  getPromotionalTexts?: boolean;

  @IsString()
  @IsOptional()
  couponId?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;
} 

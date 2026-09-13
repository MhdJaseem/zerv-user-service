import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

class IdineOrderAddressDto {
  @IsBoolean()
  is_guest_mode: boolean;

  @IsString()
  city: string;

  @IsString()
  @IsOptional()
  landmark: string;

  @IsString()
  @IsOptional()
  pin: string;

  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;

  @IsString()
  tag: string;

  @IsString()
  @IsOptional()
  line_1: string;

  @IsString()
  @IsOptional()
  line_2: string | null;

  @IsString()
  sub_locality: string;
}

class IdineCustomerDto {
  @IsString()
  phone: string;

  @ValidateNested()
  @Type(() => IdineOrderAddressDto)
  address: IdineOrderAddressDto;

  @IsEmail()
  email: string;

  @IsString()
  name: string;
}

class IdineOrderItemTagDto {
  @IsNumber()
  id: number;

  @IsBoolean()
  is_system: boolean;

  @IsString()
  title: string;
}

class IdineOrderItemTagGroupDto {
  @IsString()
  group: string;

  @IsBoolean()
  is_system: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdineOrderItemTagDto)
  tags: IdineOrderItemTagDto[];
}

class IdineItemTaxDto {
  @IsNumber()
  rate: number;

  @IsString()
  liability_on: string;

  @IsNumber()
  value: number;

  @IsString()
  title: string;
}

class IdineItemOptionGroupDto {
  @IsString()
  title: string;

  @IsBoolean()
  @IsOptional()
  default: boolean;

  @IsOptional()
  translations: any;

  @IsNumber()
  @IsOptional()
  sort_order: number;

  @IsBoolean()
  @IsOptional()
  is_variant: boolean;

  @IsString()
  @IsOptional()
  merchant_id: string;

  @IsNumber()
  @IsOptional()
  id: number;
}

class IdineItemOptionDto {
  @IsNumber()
  total_price: number;

  @ValidateNested()
  @Type(() => IdineItemOptionGroupDto)
  group: IdineItemOptionGroupDto;

  @IsString()
  title: string;

  @IsNumber()
  price: number;

  @IsOptional()
  translations: any;

  @IsNumber()
  @IsOptional()
  unit_weight: number;

  @IsNumber()
  @IsOptional()
  sort_order: number;

  @IsString()
  @IsOptional()
  merchant_id: string;

  @IsNumber()
  @IsOptional()
  id: number;

  @IsNumber()
  quantity: number;
}

class IdineOrderItemDto {
  @IsNumber()
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdineOrderItemTagGroupDto)
  tags: IdineOrderItemTagGroupDto[];

  @IsArray()
  @IsOptional()
  charges: any[];

  @IsNumber()
  total_with_tax: number;

  @IsNumber()
  price: number;

  @IsString()
  title: string;

  @IsOptional()
  translations: any;

  @IsNumber()
  @IsOptional()
  unit_weight: number;

  @IsNumber()
  @IsOptional()
  discount: number;

  @IsString()
  @IsOptional()
  instructions: string | null;

  @IsString()
  @IsOptional()
  image_landscape_url: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdineItemTaxDto)
  taxes: IdineItemTaxDto[];

  @IsArray()
  @IsOptional()
  options_to_remove: any[];

  @IsString()
  @IsOptional()
  image_url: string;

  @IsString()
  @IsOptional()
  food_type?: string;

  @IsString()
  @IsOptional()
  merchant_id?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => IdineItemOptionDto)
  options_to_add?: IdineItemOptionDto[];

  @IsNumber()
  @IsOptional()
  id?: number;

  @IsString()
  @IsOptional()
  discount_code?: string | null;

  @IsNumber()
  quantity: number;
}

class IdineOrderDetailsDto {
  @IsString()
  @IsOptional()
  coupon: string;

  @IsNumber()
  @IsOptional()
  total_taxes?: number;

  @IsString()
  merchant_ref_id: string;

  @IsNumber()
  @IsOptional()
  order_level_total_charges?: number;

  @IsNumber()
  @IsOptional()
  id?: number;

  @IsNumber()
  @IsOptional()
  payable_amount?: number;

  @IsNumber()
  @IsOptional()
  total_external_discount?: number;

  @IsNumber()
  @IsOptional()
  order_total?: number;

  @IsString()
  @IsOptional()
  order_type?: string;

  @IsOptional()
  expected_pickup_time: any;

  @IsString()
  @IsOptional()
  state?: string;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsOptional()
  modified_from: any;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsNumber()
  @IsOptional()
  delivery_datetime?: number;

  @IsNumber()
  @IsOptional()
  item_level_total_charges?: number;

  @IsNumber()
  @IsOptional()
  item_taxes?: number;

  @IsOptional()
  modified_to: any;

  @IsNumber()
  @IsOptional()
  item_level_total_taxes?: number;

  @IsNumber()
  @IsOptional()
  biz_id?: number;

  @IsString()
  @IsOptional()
  order_state?: string;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsNumber()
  @IsOptional()
  total_charges?: number;

  @IsOptional()
  dash_config: any;

  @IsNumber()
  @IsOptional()
  created?: number;

  @IsArray()
  @IsOptional()
  charges: any[];

  @IsArray()
  @IsOptional()
  ext_platforms: any[];

  @IsString()
  biz_name: string;

  @IsArray()
  @IsOptional()
  taxes: any[];

  @IsNumber()
  @IsOptional()
  order_level_total_taxes?: number;

  @IsNumber()
  @IsOptional()
  order_subtotal?: number;
}

class IdinePaymentDto {
  @IsNumber()
  amount: number;

  @IsString()
  option: string;

  @IsOptional()
  srvr_trx_id: string | null;
}

class IdineStoreDto {
  @IsString()
  name: string;

  @IsNumber()
  longitude: number;

  @IsString()
  merchant_ref_id: string;

  @IsString()
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  id: number;
}

class IdineOrderDto {
  @IsArray()
  @IsString({ each: true })
  next_states: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdineOrderItemDto)
  items: IdineOrderItemDto[];

  @ValidateNested()
  @Type(() => IdineOrderDetailsDto)
  details: IdineOrderDetailsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdinePaymentDto)
  payment: IdinePaymentDto[];

  @ValidateNested()
  @Type(() => IdineStoreDto)
  store: IdineStoreDto;

  @IsString()
  next_state: string;
}

export class IdinePlaceOrderDto {
  @ValidateNested()
  @Type(() => IdineCustomerDto)
  customer: IdineCustomerDto;

  @ValidateNested()
  @Type(() => IdineOrderDto)
  order: IdineOrderDto;
}

import { Type } from 'class-transformer';
import { IsString, IsNotEmpty,IsObject, IsEnum, IsOptional, ValidateNested, IsNumber, IsArray, IsIn } from 'class-validator';
import { DeliveryProviderEnum } from '../../../common/enums/delivery.enum';

class AddressDto {
  @IsString()
  @IsNotEmpty()
  streetAddress: string;

  @IsString()
  @IsOptional()
  apartment?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}

export class CreateDeliveryOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsEnum(DeliveryProviderEnum)
  @IsOptional()
  provider?: DeliveryProviderEnum;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsNotEmpty()
  pickupAddress: AddressDto;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsNotEmpty()
  deliveryAddress: AddressDto;

  @IsNumber()
  @IsOptional()
  deliveryFee?: number;

  @IsString()
  @IsOptional()
  branchName?: string;

  @IsString()
  @IsOptional()
  branchPhone?: string;

  @IsNumber()
  @IsNotEmpty()
  orderAmount: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => {
    class ItemDto {
      @IsString()
      @IsNotEmpty()
      name: string;

      @IsNumber()
      @IsNotEmpty()
      quantity: number;

      @IsNumber()
      @IsNotEmpty()
      price: number;
    }
    return ItemDto;
  })
  items?: {
    name: string;
    quantity: number;
    price: number;
  }[];

  @IsOptional()
  @ValidateNested()
  @Type(() => {
    class CustomerInfoDto {
      @IsString()
      @IsNotEmpty()
      name: string;

      @IsString()
      @IsNotEmpty()
      phone: string;
    }
    return CustomerInfoDto;
  })
  customerInfo?: {
    name: string;
    phoneNumber: string;
    email: string;
  };
}

export class LocationDto {
  @IsString()
  @IsIn(['Point'])
  type: string;
  @IsArray()
  coordinates: number[];
}

export class DeliveryLocationDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsObject()
  @Type(() => LocationDto)
  @ValidateNested()
  location: LocationDto;
}


import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  ValidateNested,
  IsNotEmpty,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IAddress, ILocation } from '../../../common/interfaces/address.interface';

export class LocationDto implements ILocation {
  @IsString()
  @IsNotEmpty()
  type: 'Point';

  @IsArray()
  @IsNotEmpty()
  @IsLongitude({ each: true })
  @IsLatitude({ each: true })
  coordinates: [number, number];
}

export class CreateAddressDto implements IAddress {
  @IsString()
  @IsOptional()
  addressId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsArray()
  @IsNotEmpty()
  streetAddress: string[];

  @IsString()
  @IsNotEmpty()
  city: string; 

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsNotEmpty()
  location: LocationDto;
}

export class LocateUserQueriesDto {
  @Transform(({ value }) => parseFloat(value))
  @IsNotEmpty()
  lat: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNotEmpty()
  long: number;
}

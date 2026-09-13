import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class IdineUpdaterDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class IdineExternalChannelDto {
  @IsString()
  order_id: string;

  @IsString()
  name: string;
}

class IdineAdditionalInfoDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => IdineExternalChannelDto)
  external_channel?: IdineExternalChannelDto;
}

/**
 * POS-initiated order status change relayed to Zerv (see partner doc: Order update Payload).
 */
export class IdinePosOrderStatusDto {
  @IsString()
  new_state: string;

  @IsNumber()
  order_id: number;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsNumber()
  store_upipr_id?: number;

  @IsOptional()
  @IsString()
  prev_state?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IdineUpdaterDto)
  updater?: IdineUpdaterDto;

  @IsOptional()
  @IsNumber()
  timestamp_unix?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IdineAdditionalInfoDto)
  additional_info?: IdineAdditionalInfoDto;

  @IsOptional()
  @IsString()
  store_id?: string;
}

import { IsBoolean, IsNumber, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class IdineOosItemDto {
  @IsNumber()
  upipr_id: number;

  @IsString()
  ref_id: string;
}

/**
 * POS-initiated "Out of stock" (OOS) event for specific items in an order.
 */
export class IdineOrderOosDto {
  @IsNumber()
  order_upipr_id: number;

  @IsString()
  order_ref_id: string;

  @IsBoolean()
  allow_edit: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdineOosItemDto)
  items_oos: IdineOosItemDto[];
}

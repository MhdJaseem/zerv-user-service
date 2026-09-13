import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { OrderStatus } from '../../../common/enums/user.enum';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsEnum(OrderStatus)
  @IsOptional()
  orderStatus?: OrderStatus;

  @IsString()
  @IsOptional()
  deliveryOrderId?: string;
}
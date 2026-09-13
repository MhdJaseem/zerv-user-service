import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponDto } from './coupons.dto';

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

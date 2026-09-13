import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IBillPaymentDetails } from 'src/common/interfaces/payment.interface';
import { CurrencyEnum, PaymentGatewayEnum, PaymentMethod, PaymentModeEnum, PaymentStatusEnum, PaymentTypeEnum } from 'src/common/enums/payment.enums';
import { BillPaymentDetailsDto } from './create-payment.dto';

export class CreateBranchPaymentDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(PaymentModeEnum)
  @IsNotEmpty()
  paymentMode: PaymentModeEnum;

  @IsEnum(PaymentTypeEnum)
  @IsNotEmpty()
  paymentType: PaymentTypeEnum;

  @ValidateNested()
  @Type(() => BillPaymentDetailsDto)
  @IsNotEmpty()
  billDetails: IBillPaymentDetails;

  @IsBoolean()
  @IsNotEmpty()
  isPaid: boolean;

  @IsNumber()
  @IsOptional()
  totalRefundAmount?: number;

  @IsBoolean()
  @IsOptional()
  isPartialRefund?: boolean;

  @IsEnum(PaymentGatewayEnum)
  @IsOptional()
  gateway?: PaymentGatewayEnum;

  @IsString()
  @IsOptional()
  gatewayOrderId?: string;

  @IsString()
  @IsOptional()
  gatewayPlinkId?: string;

  @IsString()
  @IsOptional()
  pLink?: string;

  @IsObject()
  @IsOptional()
  gatewayResponse?: Object;

  @IsNumber()
  @IsOptional()
  feePercentage?: number;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsOptional()
  metaData?: Record<string, string>;

  @IsEnum(CurrencyEnum)
  @IsNotEmpty()
  currency: CurrencyEnum;

  @IsEnum(PaymentStatusEnum)
  @IsNotEmpty()
  status: PaymentStatusEnum;
}

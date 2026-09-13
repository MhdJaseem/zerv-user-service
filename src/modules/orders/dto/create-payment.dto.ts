import { IsEmail, IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, IsBoolean, IsObject, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { IBillPaymentDetails, IPayment } from "src/common/interfaces/payment.interface";
import { PaymentModeEnum, PaymentTypeEnum, PaymentGatewayEnum, CurrencyEnum, PaymentStatusEnum, PaymentMethod } from "src/common/enums/payment.enums";

export class BillPaymentDetailsDto implements IBillPaymentDetails {
    @IsNumber()
    @IsNotEmpty()
    netAmount: number; //item's total amount

    @IsNumber()
    @IsNotEmpty()
    totalTax: number;

    @IsNumber()
    @IsNotEmpty()
    roundOff: number;

    @IsNumber()
    @IsNotEmpty()
    grandTotal: number; //overall total amount

    @IsNumber()
    @IsNotEmpty()
    deliveryCharge: number;

    @IsNumber()
    @IsNotEmpty()
    deliveryTipAmount: number;

    @IsNumber()
    @IsNotEmpty()
    discountAmount: number;

    @IsNumber()
    @IsNotEmpty()
    revisedTax: number;

    @IsNumber()
    @IsNotEmpty()
    revisedRoundOff: number;
}

export class CreatePaymentDto implements IPayment {
    @IsString()
    @IsOptional()
    @IsNotEmpty()
    paymentId: string;

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

    @IsObject()
    @IsOptional()
    metaData?: Record<string, string>;

    @IsString()
    @IsNotEmpty()
    remarks: string;

    @IsString()
    @IsOptional()
    qrCodeImageUrl?: string;

    @IsString()
    @IsOptional()
    qrCodeId?: string;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    mobile: string;

    @IsString()
    @IsNotEmpty()
    customerId: string;

    @IsString()
    @IsOptional()
    customerName?: string;

    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @IsEnum(CurrencyEnum)
    @IsNotEmpty()
    currency: CurrencyEnum;

    @IsEnum(PaymentStatusEnum)
    @IsNotEmpty()
    status: PaymentStatusEnum;
}

export class CreatePaymentWithCustomerIdDto {
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @IsEnum(PaymentModeEnum)
    @IsNotEmpty()
    paymentMode: PaymentModeEnum
}

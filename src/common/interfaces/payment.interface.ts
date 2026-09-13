import { CurrencyEnum, PaymentGatewayEnum, PaymentMethod, PaymentModeEnum, PaymentStatusEnum, PaymentTypeEnum } from "../enums/payment.enums";

export interface IBillPaymentDetails {
  netAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  revisedTax?: number;
  revisedRoundOff?: number;
  deliveryCharge?: number;
  discountAmount?: number;
  deliveryTipAmount: number;
}

export interface IPayment {
  paymentId: string;
  email: string;
  mobile: string;
  customerId: string;
  customerName?: string;
  status: PaymentStatusEnum;
  currency: CurrencyEnum;
  paymentMode: PaymentModeEnum;
  paymentType: PaymentTypeEnum;
  billDetails: IBillPaymentDetails;
  amount: number;
  isPaid: boolean;
  totalRefundAmount?: number;
  isPartialRefund?: boolean;
  gateway?: PaymentGatewayEnum;
  gatewayOrderId?: string;
  gatewayPlinkId?: string;
  pLink?: string;
  gatewayResponse?: Object;
  metaData?: Record<string, string>;
  remarks: string;
  qrCodeImageUrl?: string;
  qrCodeId?: string;
  description?: string;
  clientSecret?: string;
  payout?: number;
  processingFee?: number;
}

export interface IPaymentInfo {
  paymentId: string;
  paymentStatus: PaymentStatusEnum;
  gatewayOrderId?: string;
  gatewayResponse?: Object;
  metaData?: Record<string, string>;
  remarks: string;
  restaurantId: string;
  totalRefundAmount?: number;
  pointsToDeduct?: number;
  fullyRefund?: boolean;
}

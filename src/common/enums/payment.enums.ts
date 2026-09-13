export enum PaymentStatusEnum {
    PAYMENT_CREATED = 'created',
    REFUND_INITIATED = 'refundInitiated',
    REFUND_FAILED = 'refundFailed',
    REFUND_PROCESSED = 'refundProcessed',
    PARTIALLY_REFUNDED = 'partiallyRefunded',
    PAYMENT_FAILED = 'failed',
    PAYMENT_COMPLETED = 'completed',
    PAYMENT_PENDING = 'pending',
    PAYMENT_CANCELLED = 'cancelled'
}

export enum CurrencyEnum {
    INR = 'INR',
    USD = 'USD',
    EUR = 'EUR',
    GBP = 'GBP',
}

export enum PaymentModeEnum {
    ONLINE = 'online',
    CASH = 'cash',
}

export enum PaymentTypeEnum {
    PAYMENT = 'payment',
    REFUND = 'refund',
}

export enum PaymentGatewayEnum {
    RAZORPAY = 'razorpay',
    STRIPE = 'stripe',
}

export enum PaymentMethod {
    CARD = 'card',
    UPI = 'upi',
    NET_BANKING = 'netBanking'
}






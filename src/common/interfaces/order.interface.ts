import { PaymentStatusEnum } from "../enums/payment.enums";
import { OrderStatus, OrderTypeEnum } from "../enums/user.enum";

export interface IModifierOption {
  optionId: string;
  optionName: string;
}

export interface IModifierGroup {
  modifierGroupId: string;
  modifierGroupName: string;
  options: IModifierOption[];
}

export interface ICartItemO {
  productId: string;
  productName: string;
  description?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  modifierGroupId?: IModifierGroup[];
  specialInstructions?: string;
}

export interface OrderTime {
  from: string;
  to: string;
}

export interface IPaymentObj {
  paymentStatus: PaymentStatusEnum;
  totalRefundAmount: number;
  payout: number;
  processingFee: number;
}

export interface IOrder {
  orderId: string;
  restaurantId: string;
  branchId: string;
  orderDate: Date;
  orderTime: OrderTime;
  orderStatus: OrderStatus;
  orderType: OrderTypeEnum;
  items: ICartItemO[];
  userId: string;
  address?: IAddressDetails;
  customerInfo?: {
    name: string;
    phoneNumber: string;
    email: string;
  };
  pointsToAdd: number;
  pointsToBeRedeemed: number;
  totalPointsToBeAdded: number;
  includeUtensils?: boolean;
  paymentId?: string;
  deliveryOrderId?: string;
  location?: ILocation;
  total?: number;
  subtotal?: number;
  taxes?: number;
  createdAt?: string;
  updatedAt?: string;
  deliveryFee?: number;
  deliveryTipAmount?: number;
  getPromotionalEmails?: boolean;
  getPromotionalTexts?: boolean;
  paymentInfo?: IPaymentObj;
  platformFee?: number;
  couponCode?: string;
  couponDiscountAmount?: number;
}

export interface IBranch {
  branchId?: string;
  restaurantId: string;
  name: string;
  address: string;
  location: ILocation;
  phone: string;
  email: string;
  timezone: string;
  taxRate: number;
  autoAcceptOrder?: boolean
  stripeKey: string;
  cuisineType: ICuisineType[];
  hours: {
    storeHours: IHours[];
    pickupHours: IHours[];
    deliveryHours: IHours[];
  };
  preparationTimeInMins: string[];
  deliveryRadiusKm?: number; // Maximum delivery radius in kilometers
}

export interface IHours {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
}

export interface ILocation {
  type: 'Point';
  coordinates: [number, number];
}

export interface ICuisineType {
  cuisineId: string;
  cuisineName: string;
}

export interface IAddressDetails {
  apartment?: string;
  streetAddress: string[];
  city: string;
  state: string;
  zipCode: string;
  country: string;
  location: ILocation;
}

export interface DailySales {
  date: string;
  totalSales: number;
  orderCount: number;
}

export interface OrderStatsWithComparison extends OrderStats {
  comparison: {
    previousPeriodSales: number;
    sales: {
      trend: 'increase' | 'decrease' | 'no_change';
      percentage: number;
    }
    previousPeriodOrders: number;
    orders: {
      trend: 'increase' | 'decrease' | 'no_change';
      percentage: number;
    }
    previousPeriodAverage: number;
    average: {
      trend: 'increase' | 'decrease' | 'no_change';
      percentage: number;
    }
  };
}

export interface OrderExportData {
  orderId: string;
  orderDate: string;
  customerName: string;
  orderType: string;
  orderStatus: string;
  items: string;
  subtotal: number;
  taxes: number;
  total: number;
  paymentId: string;
  branchName: string;
  payout: number;
  processingFee: number;
}

export interface OrderStats {
  totalOrders: number;
  totalSales: number;
  averageOrderValue: number;
}



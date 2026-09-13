import { DeliveryStatus, DeliveryProviderEnum } from '../../../common/enums/delivery.enum';

export interface IAddress {
  streetAddress: string;
  apartment?: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
}

export interface IDriverDetails {
  name?: string;
  phone?: string;
  tracking_url?: string;
}

export interface IDeliveryOrder {
  deliveryId: string;
  orderId: string;
  userId: string;
  restaurantId: string;
  branchId: string;
  branchName: string;
  branchPhone: string;
  branchTimeZone?: string;
  provider: DeliveryProviderEnum;
  providerOrderId?: string;
  status: DeliveryStatus;
  pickupAddress: IAddress;
  deliveryAddress: IAddress;
  createdAt?: Date;
  updatedAt?: Date;
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  deliveryFee?: number;
  deliveryTipAmount?: number;
  driverDetails?: IDriverDetails;
  providerResponse?: any; // Raw response from the provider,
  orderAmount: number;
}

export interface LocationInfo {
  address: {
    streetAddress: string[];
    apartment?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface IBranchInfo {
  branchId?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
}

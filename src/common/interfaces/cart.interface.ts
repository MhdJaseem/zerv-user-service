import { OrderTime } from 'src/modules/cart/entities/cart.entity';
import { OrderTypeEnum } from '../enums/user.enum';
import { DeliveryLocationDto, LocationDto } from 'src/modules/cart/dto/create-cart.dto';

export interface ICartItem {
  productId: string;
  productName: string;
  description?: string;
  price: number;
  quantity: number;
  pointsToAdd: number;
  pointsToRedeem: number;
  IsAddedFromRewards?: boolean;
  modifierGroups?: IModifierGroups[];
  specialInstructions?: string;
}

export interface ICustomerInfo {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
}

export interface IModifierGroups {
  modifierGroupId: string;
  options: IModifierOptions[];
}

export interface IModifierOptions {
  optionId: string;
  optionName: string;
}

export interface ICart {
  cartId: string;
  userId: string;
  branchId: string;
  orderType: OrderTypeEnum;
  items: ICartItem[];
  subtotal: number;
  taxes: number;
  total: number;
  roundOff: number;
  customerInfo?: ICustomerInfo;
  addressId?: string;
  deliveryTipAmount: number;
  restaurantId: string;
  includeUtensils: boolean;
  orderDate: string;
  orderTime: OrderTime;
  specialInstruction: string;
  platformFee: number;
  pointsToBeRedeemed: number;
  totalPointsToBeAdded?: number;
  deliveryFee: number;
  getPromotionalEmails?: boolean;
  getPromotionalTexts?: boolean;
  address: DeliveryLocationDto;
  couponId?: string;
  couponCode?: string;
  couponDiscountAmount?: number;
  couponExpiryDate?: Date;
} 
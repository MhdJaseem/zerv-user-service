export enum UserTypeEnum {
  CUSTOMER = 'customer',
  Guest = 'guest',
  STRIPE = 'stripe',
}

export enum OrderTypeEnum {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
}

export enum OrderPageEnum {
  SCHEDULED = 'scheduled',
  PLACED = 'placed',
  COOKING = 'cooking',
}

export enum OrderStatus {
  PENDING = 'pending',
  PLACED = 'placed',
  ACCEPTED = 'accepted',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'readyForPickup',
  RIDER_ASSIGNED = 'riderAssigned',
  ORDER_COMPLETED = 'orderCompleted',
  REFUNDED = 'orderRefunded',
  CANCELLED = 'cancelled',
}

export enum AttributeNames {
  CustomerAdmin = 'customer_admin',
  RestaurantAdmin = 'restaurant_admin',
  BranchAdmin = 'branch_admin'
}

export enum AttributeAccess {
  ALL = 'all',
  READ = 'read',
  Manage = 'manage'
}

export enum AdminRoles{
  SUPER_ADMIN = 'super-admin',
  ADMIN='admin'
}

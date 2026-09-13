export interface IBranchs {
    branchId?: string;
    restaurantId: string;
    name: string;
    address: string;
    location?: ILocation;
    phone: string;
    email: string;
    emailPassword?: string;
    timezone: string;
    taxRate?: number;
    cuisineType: ICuisineType[];
    hours: {
        pickupToggle?: boolean;
        deliveryToggle?: boolean;
        storeHours: IHours[];
        pickupHours: IHours[];
        deliveryHours: IHours[];
    };
    preparationTimeInMins: number;
    deliveryRadiusKm?: number;
    stripeInfo?: IStripeInfo;
    adloggsInfo?: IAdloggsInfo;
    razorpayInfo?: IRazorpayInfo;
    entranceModal?: IEntranceModal;
    isDeliveryFree?: boolean;
}

export interface IModifier {
    entityType?: string;
    entityId?: string;
    entityName?: string;
    entityEmailId?: string; // In case of admin we storing the email
}

export interface IActionLogs {
    collectionName: string;
    action: 'create' | 'update' | 'delete';
    previousState: Object;
    newState: Object;
    performedBy: IModifier;
    documentId: string;
}

export interface IStripeInfo {
    stripeAccountId: string;
    stripeEnabled: boolean;
    uberEnabled?: boolean;
    stripeOnboardingUrl: string;
}

export interface IUberInfo {
    uberClientId: string;
    uberEnabled: boolean;
    uberClientSecret: string;
    uberCustomerId: string;
}

export interface IAdloggsInfo {
    adloggsApiKey: string;
    adloggsEnabled: boolean;
    adloggsPartnerMerchantId?: string;
}

export interface IRazorpayInfo {
    razorpaySubscriptionId?: string;
    razorpayPlanId?: string;
    rpyConnectedAcctId?: string;
    subscriptionStatus?: 'CREATED' | 'ACTIVE' | 'PAST_DUE' | 'INACTIVE' | 'CANCELLED' | 'PAUSED' | 'AUTHENTICATED';
    subscriptionCurrentPeriodStart?: Date;
    subscriptionCurrentPeriodEnd?: Date;
    subscriptionChargeAt?: Date;
    subscriptionCancelledAt?: Date;
    subscriptionPausedAt?: Date;
}

export interface IEntranceModal {
    enabled?: boolean;
    title?: string;
    body?: string;
    imageName?: string;
    imageUrl?: string;
    ctaLabel?: string;
    ctaLink?: string;
    startAt?: Date | null;
    endAt?: Date | null;
}

export interface IHours {
    day: string;
    activeHours: IActiveHours[];
    isClosed: boolean;
}

export interface ILocation {
    type: string;
    coordinates: number[];
}

export interface ICuisineType {
    cuisineId: string;
    cuisineName: string;
}

export interface IActiveHours {
    open: string;
    close: string;
}


export interface IRestaurantAddresses {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string; //IN|US
}

export interface IRestaurant {
    restaurantId: string;
    restaurantName: string;
    legalEntityName?: string;
    restaurantOriginUrl: string[];
    contactInfo: IContactInfo;
    stripeInfo?: IStripeInfo;
    isDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    address: IRestaurantAddresses;
    isCateringEnabled?: boolean;
}

export interface IContactInfo {
    name: string;
    phone: string;
    title: string;
    email: string;
    url: string;
    legalEntityName?: string;
}

export interface IRestaurantAddresses {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string; //IN|US
}
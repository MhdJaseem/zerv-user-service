import { RequestMethod } from "@nestjs/common";

export enum CollectionNames {
    USERS = 'user',
    ADMIN_USERS = 'adminusers',
    REWARDS = 'rewards',
    ORDERS = 'orders',
    REVIEWS_VISIBILITY = 'reviews_visibility'
}

export enum LoginMiddlewareExcludedApiRoutes {
    HEALTH = '/health'
}

export const LoginMiddlewareExcludedApiMethods: Record<LoginMiddlewareExcludedApiRoutes, RequestMethod> = {
    [LoginMiddlewareExcludedApiRoutes.HEALTH]: RequestMethod.GET
};

export enum IdentityType {
    Google = "google",
    Facebook = "facebook",
    Apple = "apple"
}
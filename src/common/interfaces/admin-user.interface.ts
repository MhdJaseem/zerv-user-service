export interface IAdminUser {
    adminId: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber: string;
    role?: string;
    abilities: {
        attributeName: string;
        attributeAccess: string[];
    }[];
    refreshToken?: string;
    restaurantId: string;
    branchId?: string[];
    isDeleted?: boolean;
    authProvider: string;
    isEmailVerified?: boolean;
}
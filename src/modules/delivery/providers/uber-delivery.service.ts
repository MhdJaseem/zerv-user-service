import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService as HttpAxiosService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { nanoid } from 'nanoid';
import { IDeliveryProvider } from '../interfaces/delivery-provider.interface';
import { CreateDeliveryOrderDto } from '../dto/create-delivery-order.dto';
import { IDeliveryOrder, LocationInfo } from '../interfaces/delivery-order.interface';
import { DeliveryStatus, DeliveryProviderEnum } from '../../../common/enums/delivery.enum';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import * as momentTz from 'moment-timezone';

interface UberTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

interface BranchUberInfo {
    uberClientId: string;
    uberClientSecret: string;
    uberCustomerId: string;
    uberEnabled: boolean;
}

@Injectable()
export class UberDeliveryService implements IDeliveryProvider {
    private readonly apiUrl: string;
    private readonly tokenUrl: string;
    private readonly scope: string;
    private readonly grantType: string;
    
    // Branch-specific token caching
    private branchTokens: Map<string, { token: string; expiryTime: number }> = new Map();
    private branchUberInfo: Map<string, BranchUberInfo> = new Map();

    constructor(
        private readonly httpAxiosService: HttpAxiosService,
        private readonly httpClientService: HttpClientService,
    ) {
        this.apiUrl = process.env.UBER_DELIVERY_API || 'https://api.uber.com/v1/customers';
        this.tokenUrl = process.env.UBER_TOKEN_URL || 'https://auth.uber.com/oauth/v2/token';
        this.scope = process.env.UBER_SCOPE || 'eats.deliveries';
        this.grantType = process.env.UBER_GRANT_TYPE || 'client_credentials';
    }

    private async getBranchUberInfo(branchId: string): Promise<BranchUberInfo> {
        // If we already have the info for this branch, return it
        if (this.branchUberInfo.has(branchId)) {
            return this.branchUberInfo.get(branchId)!;
        }

        try {
            const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);

            if (!branch?.uberInfo?.uberEnabled) {
                throw new HttpException(
                    'Uber delivery is not enabled for this branch',
                    HttpStatus.BAD_REQUEST
                );
            }

            // Store the branch info
            this.branchUberInfo.set(branchId, branch.uberInfo);

            return branch.uberInfo;
        } catch (error) {
            console.log(`uber API errorlog ${error}`);
            throw new HttpException(
                `Failed to get branch Uber info: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    private async getAccessToken(branchId: string): Promise<string> {
        // Check if we have a valid token for this branch
        const branchToken = this.branchTokens.get(branchId);
        if (branchToken && Date.now() < branchToken.expiryTime) {
            return branchToken.token;
        }

        try {
            const uberInfo = await this.getBranchUberInfo(branchId);

            console.log(`🔑 Getting Uber token for branch ${branchId} with client ID: ${uberInfo.uberClientId}`);

            const response$ = this.httpAxiosService.post<UberTokenResponse>(
                'https://auth.uber.com/oauth/v2/token',
                {
                    client_id: uberInfo.uberClientId,
                    client_secret: uberInfo.uberClientSecret,
                    scope: this.scope,
                    grant_type: this.grantType
                },
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const response = await lastValueFrom(response$);

            // Store the new token and calculate expiry time for this branch
            const tokenData = {
                token: response.data.access_token,
                expiryTime: Date.now() + (response.data.expires_in * 1000)
            };
            this.branchTokens.set(branchId, tokenData);

            console.log(`✅ Uber token obtained for branch ${branchId}, expires in ${response.data.expires_in} seconds`);

            return tokenData.token;
        } catch (error) {
            console.error(`❌ Failed to get Uber token for branch ${branchId}:`, error.message);
            throw new HttpException(
                'Failed to obtain Uber access token',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    private async getHeaders(branchId: string) {
        const token = await this.getAccessToken(branchId);
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Clear expired tokens from cache
     */
    private clearExpiredTokens(): void {
        const now = Date.now();
        for (const [branchId, tokenData] of this.branchTokens.entries()) {
            if (now >= tokenData.expiryTime) {
                console.log(`🗑️ Clearing expired token for branch ${branchId}`);
                this.branchTokens.delete(branchId);
            }
        }
    }

    /**
     * Get cache statistics for debugging
     */
    private getCacheStats(): { branchTokens: number; branchUberInfo: number } {
        this.clearExpiredTokens(); // Clean up expired tokens first
        return {
            branchTokens: this.branchTokens.size,
            branchUberInfo: this.branchUberInfo.size
        };
    }

    async createDeliveryOrder(orderData: CreateDeliveryOrderDto): Promise<IDeliveryOrder> {
        try {
            // Get branch info and validate Uber is enabled
            const uberInfo = await this.getBranchUberInfo(orderData.branchId);

            // Transform the order data into the format expected by Uber API
            const uberPayload = this.transformToUberFormat(orderData);
            console.log(`uberPayload before calling Uber API ${JSON.stringify(uberPayload)}`);
            // Make the API call to Uber
            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/${uberInfo.uberCustomerId}/deliveries`,
                uberPayload,
                { headers: await this.getHeaders(orderData.branchId) }
            );

            const response = await lastValueFrom(response$);

            // Transform Uber's response into our standard delivery order format
            return this.transformFromUberResponse(response.data, orderData);
        } catch (error) {
            console.log(`uber API errorlog ${error}`);
            if (error.response) {
                throw new HttpException(
                    `Uber API error: ${JSON.stringify(error.response.data) || 'Unknown error'}`,
                    error.response.status || HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
            throw new HttpException(
                'Failed to create delivery with Uber',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async getDeliveryStatus(deliveryId: string, branchId: string): Promise<DeliveryStatus> {
        try {
            const uberInfo = await this.getBranchUberInfo(branchId);

            const response$ = this.httpAxiosService.get(
                `${this.apiUrl}/${uberInfo.uberCustomerId}/deliveries/${deliveryId}`,
                { headers: await this.getHeaders(branchId) }
            );

            const response = await lastValueFrom(response$);

            // Map Uber's status to our standard status
            return this.mapProviderStatusToDeliveryStatus(response.data.status);
        } catch (error) {
            throw new HttpException(
                `Failed to get delivery status: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async cancelDelivery(deliveryId: string, branchId: string): Promise<boolean> {
        try {
            const uberInfo = await this.getBranchUberInfo(branchId);

            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/${uberInfo.uberCustomerId}/deliveries/${deliveryId}/cancel`,
                {},
                { headers: await this.getHeaders(branchId) }
            );

            await lastValueFrom(response$);

            return true;
        } catch (error) {
            throw new HttpException(
                `Failed to cancel delivery: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async updateDeliveryStatus(deliveryId: string, status: DeliveryStatus, branchId: string): Promise<IDeliveryOrder> {
        try {
            const uberInfo = await this.getBranchUberInfo(branchId);

            const response$ = this.httpAxiosService.get(
                `${this.apiUrl}/${uberInfo.uberCustomerId}/deliveries/${deliveryId}`,
                { headers: await this.getHeaders(branchId) }
            );

            const response = await lastValueFrom(response$);

            // Return a simplified delivery order with updated status
            return {
                deliveryId,
                providerOrderId: response.data.id,
                status: this.mapProviderStatusToDeliveryStatus(response.data.status),
                providerResponse: response.data,
            } as IDeliveryOrder;
        } catch (error) {
            throw new HttpException(
                `Failed to update delivery status: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // Helper methods for transforming data between our format and Uber's format
    private transformToUberFormat(orderData: any): any {
        // Format pickup address
        const pickupAddressJson = {
            street_address: [orderData.pickupAddress.streetAddress],
            state: orderData.pickupAddress.state,
            city: orderData.pickupAddress.city,
            zip_code: orderData.pickupAddress.zipCode,
            country: orderData.pickupAddress.country
        };

        // Format dropoff address with apartment number
        const dropoffAddressJson = {
            street_address: [orderData.deliveryAddress.streetAddress],
            state: orderData.deliveryAddress.state,
            city: orderData.deliveryAddress.city,
            zip_code: orderData.deliveryAddress.zipCode,
            country: orderData.deliveryAddress.country
        };

        // Add apartment number to the first street address element if it exists
        if (orderData.deliveryAddress.apartment) {
            dropoffAddressJson.street_address[0] = `${orderData.deliveryAddress.streetAddress} #${orderData.deliveryAddress.apartment}`;
        } else if (orderData.deliveryAddress.streetAddress && orderData.deliveryAddress.streetAddress.includes('apartment No.')) {
            // If apartment is already embedded in street address, format it properly for Uber
            const streetAddress = orderData.deliveryAddress.streetAddress.replace('apartment No. ', '');
            const parts = streetAddress.split(' ');
            if (parts.length >= 2) {
                const apartmentNumber = parts[0];
                const actualStreetAddress = parts.slice(1).join(' ');
                dropoffAddressJson.street_address[0] = `${actualStreetAddress} #${apartmentNumber}`;
            } else {
                // Fallback: if parsing fails, use the original address
                dropoffAddressJson.street_address[0] = orderData.deliveryAddress.streetAddress;
            }
        }

        // Transform items to manifest items
        const manifestItems = orderData.items?.map(item => ({
            name: item.name,
            quantity: item.quantity,
            size: "small", // Default size, could be configurable
            price: Math.round(item.price * 100), // Convert to cents
            dimensions: {
                length: 20, // Default dimensions, could be configurable
                height: 20,
                depth: 20
            },
            must_be_upright: false,
            weight: 300, // Default weight in grams, could be configurable
            preferred_replacements: null
        })) || [];

        interface UberPayload {
            pickup_address: string;
            pickup_name: string;
            pickup_phone_number: string;
            pickup_latitude: number;
            pickup_longitude: number;
            dropoff_address: string;
            dropoff_name: string;
            dropoff_phone_number: string;
            dropoff_latitude: number;
            dropoff_longitude: number;
            order_value: number;
            currency_code: string;
            tip?: number;
            external_order_id: string;
            external_user_id: string;
            manifest_items: any[];
            pickup_ready_dt?: string;
            pickup_deadline_dt?: string;
            pickup_verification?: {
                picture: boolean;
            };
            dropoff_verification?: {
                picture: boolean;
            };
            test_specifications?: {
                robo_courier_specification: {
                    mode: string;
                };
            };
            dropoff_notes?: string;
        }

        const payload: UberPayload = {
            pickup_address: JSON.stringify(pickupAddressJson),
            pickup_name: orderData.branchName || "Restaurant Name",
            pickup_phone_number: orderData.branchPhone || "+14444444444",
            pickup_latitude: orderData.pickupAddress?.latitude || 0,
            pickup_longitude: orderData.pickupAddress?.longitude || 0,
            dropoff_address: JSON.stringify(dropoffAddressJson),
            dropoff_name: orderData.customerInfo?.name || "Customer Name",
            dropoff_phone_number: orderData.customerInfo?.phoneNumber || "+15555555555",
            dropoff_latitude: orderData.deliveryAddress?.latitude || 0,
            dropoff_longitude: orderData.deliveryAddress?.longitude || 0,
            order_value: Math.round(orderData.orderAmount * 100), // Convert to cents
            currency_code: "USD",
            external_order_id: orderData.orderId,
            external_user_id: orderData.userId,
            manifest_items: manifestItems,
            pickup_verification: {
                picture: true
            },
            dropoff_verification: {
                picture: true
            },
            dropoff_notes: "Leave at my door",

        };

        // Only add test_specifications in development environment
        if (process.env.NODE_ENV === 'dev') {
            payload.tip = Math.round(orderData.deliveryTipAmount * 100) <= 2000 ? Math.round(orderData.deliveryTipAmount * 100) : 2000,
            payload.test_specifications = {
                robo_courier_specification: {
                    mode: "auto"
                }
            };
        }
        //only add pickup_ready_dt and pickup_deadline_dt in prod env
        if (process.env.NODE_ENV === 'prod') {
            payload.tip = Math.round(orderData.deliveryTipAmount * 100) <= 5000 ? Math.round(orderData.deliveryTipAmount * 100) : 5000,
            payload.pickup_ready_dt = momentTz.tz(new Date(), orderData.branchTimeZone).add(15, 'minutes').toISOString();
            payload.pickup_deadline_dt = momentTz.tz(new Date(), orderData.branchTimeZone).add(25, 'minutes').toISOString();
        }

        return payload;
    }

    private transformFromUberResponse(uberResponse: any, originalOrder: CreateDeliveryOrderDto): any {
        // Simplified example - adjust based on Uber's actual API response
        return {
            deliveryId: nanoid(),
            orderId: originalOrder.orderId,
            userId: originalOrder.userId,
            restaurantId: originalOrder.restaurantId,
            branchId: originalOrder.branchId,
            provider: DeliveryProviderEnum.UBER,
            providerOrderId: uberResponse.id,
            status: this.mapProviderStatusToDeliveryStatus(uberResponse.status),
            pickupAddress: originalOrder.pickupAddress,
            deliveryAddress: originalOrder.deliveryAddress,
            createdAt: new Date(),
            updatedAt: new Date(),
            estimatedPickupTime: uberResponse ? new Date(uberResponse.pickup_eta) : undefined,
            estimatedDeliveryTime: uberResponse ? new Date(uberResponse.dropoff_eta) : undefined,
            deliveryFee: uberResponse.fee || originalOrder.deliveryFee,
            driverDetails: uberResponse.courier ? {
                name: uberResponse.courier.name,
                phone: uberResponse.courier.phone_number,
                tracking_url: uberResponse.tracking_url,
            } : undefined,
            providerResponse: uberResponse,
        };
    }

    mapProviderStatusToDeliveryStatus(uberStatus: string): DeliveryStatus {
        // This mapping should be updated based on Uber's actual status values
        const statusMap = {
            'pending': DeliveryStatus.CREATED,
            'pickup': DeliveryStatus.PICKUP_READY,
            'pickup_complete': DeliveryStatus.PICKED_UP,
            'dropoff': DeliveryStatus.DROPOFF,
            'delivered': DeliveryStatus.DELIVERED,
            'canceled': DeliveryStatus.CANCELLED,
            'returned': DeliveryStatus.FAILED,
        };

        return statusMap[uberStatus?.toLowerCase()] || DeliveryStatus.CREATED;
    }

    async checkDeliveryAvailability(
        pickupLocation: LocationInfo,
        dropoffLocation: LocationInfo,
        branchId: string
    ): Promise<boolean> {
        try {
            const uberInfo = await this.getBranchUberInfo(branchId);
            
            console.log(`🔍 Checking delivery availability for branch ${branchId}`);
            console.log(`   - Customer ID: ${uberInfo.uberCustomerId}`);
            console.log(`   - Client ID: ${uberInfo.uberClientId}`);
            console.log(`   - Cache stats:`, this.getCacheStats());

            const payload = {
                pickup_address: JSON.stringify({
                    street_address: pickupLocation.address.streetAddress,
                    city: pickupLocation.address.city,
                    state: pickupLocation.address.state,
                    zip_code: pickupLocation.address.zipCode,
                    country: pickupLocation.address.country || 'US'
                }),
                dropoff_address: JSON.stringify({
                    street_address: dropoffLocation.address.streetAddress,
                    city: dropoffLocation.address.city,
                    state: dropoffLocation.address.state,
                    zip_code: dropoffLocation.address.zipCode,
                    country: dropoffLocation.address.country || 'US'
                }),
                pickup_latitude: pickupLocation.coordinates.latitude,
                pickup_longitude: pickupLocation.coordinates.longitude,
                dropoff_latitude: dropoffLocation.coordinates.latitude,
                dropoff_longitude: dropoffLocation.coordinates.longitude
            };

            console.log(`🌐 Making request to: ${this.apiUrl}/${uberInfo.uberCustomerId}/delivery_quotes`);

            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/${uberInfo.uberCustomerId}/delivery_quotes`,
                payload,
                { headers: await this.getHeaders(branchId) }
            );

            const response = await lastValueFrom(response$);

            console.log(`✅ Delivery availability check successful for branch ${branchId}`);
            // If we get a quote, delivery is available.
            return response.data.fee;

        } catch (error) {
            console.error(`❌ Delivery availability check failed for branch ${branchId}:`, {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });

            if (error.response?.data?.code === 'address_undeliverable') {
                return false;
            }
            throw new HttpException(
                `Failed to check delivery availability: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}

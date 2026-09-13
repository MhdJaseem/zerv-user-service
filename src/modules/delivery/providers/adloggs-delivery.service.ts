import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService as HttpAxiosService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { nanoid } from 'nanoid';
import { IDeliveryProvider } from '../interfaces/delivery-provider.interface';
import { CreateDeliveryOrderDto } from '../dto/create-delivery-order.dto';
import { IDeliveryOrder, LocationInfo, IAddress } from '../interfaces/delivery-order.interface';
import { DeliveryStatus, DeliveryProviderEnum } from '../../../common/enums/delivery.enum';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import * as momentTz from 'moment-timezone';

interface BranchAdloggsInfo {
    adloggsApiKey: string;
    adloggsEnabled: boolean;
    adloggsPartnerMerchantId?: string; // Optional merchant ID for multi-branch support
}

@Injectable()
export class AdloggsDeliveryService implements IDeliveryProvider {
    private readonly apiUrl: string;
    
    // Branch-specific API key caching
    private branchAdloggsInfo: Map<string, BranchAdloggsInfo> = new Map();

    constructor(
        private readonly httpAxiosService: HttpAxiosService,
        private readonly httpClientService: HttpClientService,
    ) {
        // Adloggs API URLs: https://dev.adloggs.com or https://app.adloggs.com
        this.apiUrl = process.env.ADLOGGS_DELIVERY_API || 'https://app.adloggs.com';
    }

    private async getBranchAdloggsInfo(branchId: string): Promise<BranchAdloggsInfo> {
        if (this.branchAdloggsInfo.has(branchId)) {
            return this.branchAdloggsInfo.get(branchId)!;
        }

        try {
            const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);

            if (!branch?.adloggsInfo?.adloggsEnabled) {
                throw new HttpException(
                    'Adloggs delivery is not enabled for this branch',
                    HttpStatus.BAD_REQUEST
                );
            }

            this.branchAdloggsInfo.set(branchId, branch.adloggsInfo);
            return branch.adloggsInfo;
        } catch (error) {
            console.error(`Failed to get branch Adloggs info: ${error.message}`);
            throw new HttpException(
                `Failed to get branch Adloggs info: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get headers with API key authentication for Adloggs
     * Adloggs uses x-api-key header (lowercase)
     */
    private async getHeaders(branchId: string) {
        const adloggsInfo = await this.getBranchAdloggsInfo(branchId);
        
        return {
            'x-api-key': adloggsInfo.adloggsApiKey, // Lowercase as per Adloggs documentation
            'Content-Type': 'application/json',
        };
    }

    /**
     * Get cache statistics for debugging
     */
    private getCacheStats(): { branchAdloggsInfo: number } {
        return {
            branchAdloggsInfo: this.branchAdloggsInfo.size
        };
    }

    async createDeliveryOrder(orderData: CreateDeliveryOrderDto): Promise<IDeliveryOrder> {
        try {
            const adloggsInfo = await this.getBranchAdloggsInfo(orderData.branchId);
            
            // Fetch branch data to get missing fields
            const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${orderData.branchId}`);
            const branchTimeZone = branch?.timezone || 'America/New_York';
            
            const adloggsPayload = this.transformToAdloggsFormat(orderData, adloggsInfo, branch);
            
            console.log(`📦 Creating Adloggs delivery order for: ${orderData.orderId}`);
            console.log(`   Adloggs Payload: ${JSON.stringify(adloggsPayload, null, 2)}`);
            
            // Endpoint: /aa/oporder/v2/create
            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/aa/oporder/v2/create`,
                adloggsPayload,
                { headers: await this.getHeaders(orderData.branchId) }
            );

            const response = await lastValueFrom(response$);
            
            console.log(`✅ Adloggs order created successfully: ${JSON.stringify(response.data)}`);

            return this.transformFromAdloggsResponse(response.data, orderData, branch);
        } catch (error) {
            console.error(`❌ Adloggs API error:`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            
            if (error.response?.data) {
                throw new HttpException(
                    `Adloggs API error: ${error.response.data.message || JSON.stringify(error.response.data)}`,
                    error.response.status || HttpStatus.INTERNAL_SERVER_ERROR
                );
            }
            throw new HttpException(
                `Failed to create delivery with Adloggs: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async getDeliveryStatus(deliveryId: string, branchId: string): Promise<DeliveryStatus> {
        try {
            // Endpoint: /aa/oporder/getcurrentstatus
            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/aa/oporder/getcurrentstatus`,
                { order_uuid: deliveryId },
                { headers: await this.getHeaders(branchId) }
            );

            const response = await lastValueFrom(response$);

            if (response.data.status && response.data.data) {
                return this.mapProviderStatusToDeliveryStatus(response.data.data.order_status_id.toString());
            }

            throw new HttpException(
                'Invalid response from Adloggs',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        } catch (error) {
            console.error(`Failed to get delivery status from Adloggs: ${error.message}`);
            throw new HttpException(
                `Failed to get delivery status: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async cancelDelivery(deliveryId: string, branchId: string): Promise<boolean> {
        try {
            // Endpoint: /aa/oporder/v1.2/cancel
            // Note: After pickup, order cannot be cancelled
            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/aa/oporder/v1.2/cancel`,
                {
                    order_uuid: deliveryId,
                    order_cancel_description: 'Order cancelled by restaurant'
                },
                { headers: await this.getHeaders(branchId) }
            );

            const response = await lastValueFrom(response$);

            if (response.data.status) {
                console.log(`✅ Adloggs order cancelled: ${deliveryId}`);
                return true;
            }

            throw new HttpException(
                response.data.message || 'Failed to cancel order',
                HttpStatus.BAD_REQUEST
            );
        } catch (error) {
            console.error(`Failed to cancel Adloggs delivery: ${error.message}`);
            
            // Handle specific cancellation errors from Adloggs
            if (error.response?.data?.message) {
                throw new HttpException(
                    error.response.data.message,
                    HttpStatus.BAD_REQUEST
                );
            }
            
            throw new HttpException(
                `Failed to cancel delivery: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async updateDeliveryStatus(deliveryId: string, status: DeliveryStatus, branchId: string): Promise<IDeliveryOrder> {
        try {
            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/aa/oporder/getcurrentstatus`,
                { order_uuid: deliveryId },
                { headers: await this.getHeaders(branchId) }
            );

            const response = await lastValueFrom(response$);

            if (response.data.status && response.data.data) {
                return {
                    deliveryId,
                    providerOrderId: response.data.data.order_uuid,
                    status: this.mapProviderStatusToDeliveryStatus(response.data.data.order_status_id.toString()),
                    driverDetails: response.data.data.deliveryStaffDetails ? {
                        name: response.data.data.deliveryStaffDetails.name,
                        phone: response.data.data.deliveryStaffDetails.phone,
                        tracking_url: response.data.data.trackUrl,
                    } : undefined,
                    providerResponse: response.data.data,
                } as IDeliveryOrder;
            }

            throw new HttpException(
                'Invalid response from Adloggs',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        } catch (error) {
            throw new HttpException(
                `Failed to update delivery status: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Transform internal order format to Adloggs API format
     * Based on Adloggs API Documentation - Create Order endpoint
     */
    private transformToAdloggsFormat(orderData: CreateDeliveryOrderDto, adloggsInfo: BranchAdloggsInfo, branch: any): any {
        // Format pickup datetime (YYYY-MM-DD HH:mm)
        const branchTimeZone = branch?.timezone || 'America/New_York';
        const pickupDateTime = momentTz.tz(new Date(), branchTimeZone).add(15, 'minutes').format('YYYY-MM-DD HH:mm');

        // Calculate UTC offset in minutes (e.g., 330 for India, -240 for Cuba CDT)
        const utcOffset = momentTz.tz(branchTimeZone).utcOffset();

        // Get branch coordinates
        const branchCoordinates = branch?.location?.coordinates || [];
        const branchLatitude = branchCoordinates.length > 1 ? branchCoordinates[1] : 0;
        const branchLongitude = branchCoordinates.length > 0 ? branchCoordinates[0] : 0;

        // Get delivery coordinates from the DTO
        const deliveryLatitude = orderData.deliveryAddress.latitude || 0;
        const deliveryLongitude = orderData.deliveryAddress.longitude || 0;

        // Parse addresses - AddressDto only has streetAddress (string), city, zipCode, apartment
        const pickupStreetAddress = typeof orderData.pickupAddress.streetAddress === 'string' 
            ? orderData.pickupAddress.streetAddress 
            : '';
        const deliveryStreetAddress = typeof orderData.deliveryAddress.streetAddress === 'string' 
            ? orderData.deliveryAddress.streetAddress 
            : '';

        const payload: any = {
            partner_order_id: orderData.orderId,
            partner_merchant_id: adloggsInfo.adloggsPartnerMerchantId || undefined,
            partner_reference_id: orderData.branchId,
            
            // Pickup information
            pickup_contact_name: orderData.branchName || branch?.name || 'Restaurant',
            pickup_contact_no: orderData.branchPhone || branch?.phone || '',
            pickup_contact_email: branch?.email || '',
            pickup_address: `${pickupStreetAddress}, ${orderData.pickupAddress.city}, ${orderData.pickupAddress.zipCode}`.substring(0, 500),
            pickup_address_details: {
                door_no: '',
                street_name: pickupStreetAddress,
                city_name: orderData.pickupAddress.city,
                district_name: '',
                state_name: branch?.address?.state || '',
                country_name: branch?.address?.country || 'USA',
                pincode: orderData.pickupAddress.zipCode
            },
            pickup_date_time: pickupDateTime,
            pickup_lat: branchLatitude,
            pickup_long: branchLongitude,
            
            // Delivery information
            delivery_contact_name: orderData.customerInfo?.name || 'Customer',
            delivery_contact_no: orderData.customerInfo?.phoneNumber || '',
            delivery_contact_email: orderData.customerInfo?.email || '',
            delivery_address: `${deliveryStreetAddress}${orderData.deliveryAddress.apartment ? ' ' + orderData.deliveryAddress.apartment : ''}, ${orderData.deliveryAddress.city}, ${orderData.deliveryAddress.zipCode}`.substring(0, 500),
            delivery_address_details: {
                door_no: orderData.deliveryAddress.apartment || '',
                street_name: deliveryStreetAddress,
                city_name: orderData.deliveryAddress.city,
                district_name: '',
                state_name: '',
                country_name: 'USA',
                pincode: orderData.deliveryAddress.zipCode
            },
            delivery_lat: deliveryLatitude,
            delivery_long: deliveryLongitude,
            
            // Order details
            order_category: 'Food and Beverage', // Default to "Food and Beverage"
            order_total_price: orderData.orderAmount?.toString() || '0',
            order_total_weight_in_kg: '1', // Default weight
            items: orderData.items?.map(item => ({
                name: item.name,
                quantity: item.quantity?.toString() || '1',
                price: (item.price * (item.quantity || 1))?.toString()
            })) || [],
            order_description: 'Delivery order',
            
            // Timezone
            utc_offset: utcOffset,
            
            // Payment type - default to Online
            payment_type: 'Online',
            collectible_amount: 0
        };

        // Remove undefined fields
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
    }

    /**
     * Transform Adloggs API response to internal delivery order format
     */
    private transformFromAdloggsResponse(adloggsResponse: any, originalOrder: CreateDeliveryOrderDto, branch: any): IDeliveryOrder {
        if (!adloggsResponse.status) {
            throw new HttpException(
                adloggsResponse.message || 'Failed to create order with Adloggs',
                HttpStatus.BAD_REQUEST
            );
        }

        const data = adloggsResponse.data;

        // Convert AddressDto to IAddress format
        const pickupAddress: IAddress = {
            streetAddress: originalOrder.pickupAddress.streetAddress,
            apartment: originalOrder.pickupAddress.apartment,
            city: originalOrder.pickupAddress.city,
            zipCode: originalOrder.pickupAddress.zipCode,
            latitude: branch?.location?.coordinates?.[1] || 0,
            longitude: branch?.location?.coordinates?.[0] || 0,
        };

        const deliveryAddress: IAddress = {
            streetAddress: originalOrder.deliveryAddress.streetAddress,
            apartment: originalOrder.deliveryAddress.apartment,
            city: originalOrder.deliveryAddress.city,
            zipCode: originalOrder.deliveryAddress.zipCode,
            latitude: 0, // Should be fetched from order
            longitude: 0, // Should be fetched from order
        };

        return {
            deliveryId: nanoid(),
            orderId: originalOrder.orderId,
            userId: originalOrder.userId,
            restaurantId: originalOrder.restaurantId,
            branchId: originalOrder.branchId,
            branchName: originalOrder.branchName || branch?.name || '',
            branchPhone: originalOrder.branchPhone || branch?.phone || '',
            branchTimeZone: branch?.timezone,
            provider: DeliveryProviderEnum.ADLOGGS,
            providerOrderId: data.order_uuid, // Adloggs's unique order identifier
            status: DeliveryStatus.CREATED, // Initially created, will be updated via webhook
            pickupAddress,
            deliveryAddress,
            createdAt: new Date(),
            updatedAt: new Date(),
            deliveryFee: data.fee || originalOrder.deliveryFee,
            orderAmount: originalOrder.orderAmount,
            driverDetails: data.trackUrl ? {
                tracking_url: data.trackUrl,
            } : undefined,
            providerResponse: data,
        };
    }

    /**
     * Map Adloggs status IDs to internal DeliveryStatus enum
     * Based on Adloggs API Documentation - Order Statuses
     * Interface requires string, but Adloggs uses numeric IDs, so we convert
     */
    mapProviderStatusToDeliveryStatus(providerStatus: string): DeliveryStatus {
        // Convert string to number for Adloggs status IDs
        const statusId = parseInt(providerStatus, 10);
        
        const statusMap: { [key: number]: DeliveryStatus } = {
            2: DeliveryStatus.CREATED,        // Pending
            3: DeliveryStatus.PICKUP_READY,   // Assigned
            11: DeliveryStatus.PICKUP_READY,  // Arrived at pickup
            4: DeliveryStatus.PICKED_UP,      // Picked Up
            9: DeliveryStatus.DROPOFF,        // Out For Delivery
            8: DeliveryStatus.DROPOFF,        // Arrived (at delivery location)
            5: DeliveryStatus.DELIVERED,      // Delivered
            6: DeliveryStatus.CANCELLED,      // Cancelled
            13: DeliveryStatus.RETURN,        // Return (RTO initiated)
            14: DeliveryStatus.RETURN,        // RTO-Delivered
        };

        return statusMap[statusId] || DeliveryStatus.CREATED;
    }

    /**
     * Check if delivery is available for given locations
     * Endpoint: /aa/oporder/v1.2/service/availability
     */
    async checkDeliveryAvailability(
        pickupLocation: LocationInfo,
        dropoffLocation: LocationInfo,
        branchId: string
    ): Promise<any> {
        try {
            const adloggsInfo = await this.getBranchAdloggsInfo(branchId);
            
            console.log(`🔍 Checking Adloggs delivery availability for branch ${branchId}`);

            // Get branch to get timezone
            const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);
            const branchTimeZone = branch?.timezone || 'America/New_York';

            // Calculate UTC offset
            const utcOffset = momentTz.tz(branchTimeZone).utcOffset();

            const payload: any = {
                partner_merchant_id: adloggsInfo.adloggsPartnerMerchantId || undefined,
                partner_order_id: `CHECK_${Date.now()}`, // Temporary order ID for availability check
                pickup_lat: pickupLocation.coordinates.latitude,
                pickup_long: pickupLocation.coordinates.longitude,
                pickup_pincode: pickupLocation.address.zipCode,
                delivery_lat: dropoffLocation.coordinates.latitude,
                delivery_long: dropoffLocation.coordinates.longitude,
                delivery_pincode: dropoffLocation.address.zipCode,
                utc_offset: utcOffset,
                payment_type: 'Online' // Default to Online for availability check
            };

            // Remove undefined fields
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            console.log(`🌐 Making request to: ${this.apiUrl}/aa/oporder/v1.2/service/availability with payload: ${JSON.stringify(payload)}`);

            const response$ = this.httpAxiosService.post(
                `${this.apiUrl}/aa/oporder/v1.2/service/availability`,
                payload,
                { headers: await this.getHeaders(branchId) }
            );

            const response = await lastValueFrom(response$);

            if (response.data.status && response.data.data?.service_available) {
                const distance = response.data.data.distance; // Distance in kilometers from Adloggs
                const deliveryRadiusKm = branch?.deliveryRadiusKm;
                
                console.log(`✅ Adloggs delivery available for branch ${branchId}`);
                console.log(`   - Distance: ${distance} km`);
                console.log(`   - Branch delivery radius: ${deliveryRadiusKm || 'not configured'} km`);
                console.log(`   - Estimated price: ${response.data.data.estimated_price}`);
                console.log(`   - ETA to pickup: ${response.data.data.to_pickup?.eta_min} minutes`);
                
                // Check if distance exceeds the restaurant's configured delivery radius
                if (deliveryRadiusKm !== undefined && deliveryRadiusKm !== null && distance > deliveryRadiusKm) {
                    const branchName = branch?.name || 'this restaurant';
                    throw new HttpException(
                        `Sorry, delivery is not available to your location. The delivery address is ${distance.toFixed(1)} km away, which exceeds ${branchName}'s delivery radius of ${deliveryRadiusKm} km. Please try a different address or contact the restaurant for assistance.`,
                        HttpStatus.BAD_REQUEST
                    );
                }
                
                // Return the estimated price (fee)
                return response.data.data.estimated_price;
            }

            // Service not available
            console.log(`❌ Adloggs delivery not available for branch ${branchId}: ${response.data.message}`);
            return false;

        } catch (error) {
            console.error(`❌ Adloggs delivery availability check failed for branch ${branchId}:`, {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });

            // Check for specific error codes indicating unavailability
            if (error.response?.data?.code === 202 || 
                error.response?.data?.data?.code === 'currently_service_not_available' ||
                error.response?.data?.data?.code === 'distance_too_long') {
                return false;
            }

            // For other errors, throw exception
            throw new HttpException(
                `Failed to check delivery availability: ${error.response?.data?.message || error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}

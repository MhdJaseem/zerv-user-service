import { Injectable, BadRequestException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { CreateDeliveryOrderDto } from './dto/create-delivery-order.dto';
import { IDeliveryOrder, LocationInfo } from './interfaces/delivery-order.interface';
import { DeliveryProviderEnum } from '../../common/enums/delivery.enum';
import { UberDeliveryService } from './providers/uber-delivery.service';
import { AdloggsDeliveryService } from './providers/adloggs-delivery.service';
import { IOrder } from 'src/common/interfaces/order.interface';
import { Helpers } from 'src/common/helpers/common.helpers';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { IBranchInfo } from './interfaces/delivery-order.interface';


@Injectable()
export class DeliveryService {
  private readonly defaultProvider: DeliveryProviderEnum;

  constructor(
    private readonly dbServices: IMongoDBServices,
    private readonly configService: ConfigService,
    private readonly uberDeliveryService: UberDeliveryService,
    private readonly adloggsDeliveryService: AdloggsDeliveryService,
    private readonly httpClientService: HttpClientService,
  ) {
    this.defaultProvider = this.configService.get<DeliveryProviderEnum>(
      'DEFAULT_DELIVERY_PROVIDER',
      DeliveryProviderEnum.UBER
    );
  }

  private getProviderService(provider: DeliveryProviderEnum) {
    switch (provider) {
      case DeliveryProviderEnum.UBER:
        return this.uberDeliveryService;
      case DeliveryProviderEnum.ADLOGGS:
        return this.adloggsDeliveryService;
      default:
        throw new BadRequestException(`Unsupported delivery provider: ${provider}`);
    }
  }

  async createDeliveryOrder(createDeliveryDto: CreateDeliveryOrderDto): Promise<IDeliveryOrder> {
    try {
      // Use the specified provider or the default one
      const provider = createDeliveryDto.provider || this.defaultProvider;

      // Get the appropriate provider service
      const providerService = this.getProviderService(provider);

      // Fetch order details
      const orderDetails: IOrder = await this.dbServices.order.findOne({ orderId: createDeliveryDto.orderId });
      if (!orderDetails) {
        throw new NotFoundException(`Order with ID ${createDeliveryDto.orderId} not found`);
      }

      // Populate items array from order details
      createDeliveryDto.items = orderDetails.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.price
      }));
      createDeliveryDto.orderAmount = orderDetails.total || 0;
      createDeliveryDto.customerInfo = orderDetails.customerInfo || { name: '', phoneNumber: '', email: '' };


      // Create the delivery order with the provider
      const providerDeliveryOrder = await providerService.createDeliveryOrder(createDeliveryDto);

      // Save the delivery order in our database
      const deliveryOrder = await this.dbServices.deliveryOrder.create(providerDeliveryOrder);

      return deliveryOrder;
    } catch (error) {
      const errorMessage = error?.message || error;
      const detailedError =
        typeof errorMessage === 'object'
          ? JSON.stringify(errorMessage)
          : errorMessage;

      throw new BadRequestException(
        `Failed to create delivery order: ${detailedError}`
      );
    }

  }

  // async getDeliveryStatus(deliveryId: string): Promise<DeliveryStatus> {
  //   const deliveryOrder = await this.dbServices.deliveryOrder.findOne({ deliveryId });

  //   if (!deliveryOrder) {
  //     throw new NotFoundException(`Delivery order with ID ${deliveryId} not found`);
  //   }

  //   // Get the provider service
  //   const providerService = this.getProviderService(deliveryOrder.provider);

  //   // Get the latest status from the provider
  //   const latestStatus = await providerService.getDeliveryStatus(deliveryOrder.providerOrderId!);

  //   // Update our record if the status has changed
  //   if (latestStatus !== deliveryOrder.status) {
  //     await this.dbServices.deliveryOrder.findOneAndUpdate(
  //       { deliveryId },
  //       { status: latestStatus },
  //       { new: true }
  //     );
  //   }

  //   return latestStatus;
  // }

  // async cancelDelivery(deliveryId: string): Promise<boolean> {
  //   const deliveryOrder = await this.dbServices.deliveryOrder.findOne({ deliveryId });

  //   if (!deliveryOrder) {
  //     throw new NotFoundException(`Delivery order with ID ${deliveryId} not found`);
  //   }

  //   // Get the provider service
  //   const providerService = this.getProviderService(deliveryOrder.provider);

  //   // Cancel the delivery with the provider
  //   const cancelled = await providerService.cancelDelivery(deliveryOrder.providerOrderId!);

  //   if (cancelled) {
  //     // Update the status in our database
  //     await this.dbServices.deliveryOrder.findOneAndUpdate(
  //       { deliveryId },
  //       { status: DeliveryStatus.CANCELLED },
  //       { new: true }
  //     );
  //   }

  //   return cancelled;
  // }

  async findDeliveryByOrderId(orderId: string): Promise<IDeliveryOrder> {
    const deliveryOrder = await this.dbServices.deliveryOrder.findOne({ orderId });

    if (!deliveryOrder) {
      throw new NotFoundException(`Delivery order for order ID ${orderId} not found`);
    }

    return deliveryOrder;
  }

  async findAllDeliveries(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
  ): Promise<IDeliveryOrder[]> {
    const deliveries = await this.dbServices.deliveryOrder.find(
      filter,
      undefined,
      { skip, limit, sort: { createdAt: -1 } }
    );

    return deliveries;
  }

  // This method would be used by webhooks to update delivery status
  async handleProviderWebhook(provider: DeliveryProviderEnum, data: any): Promise<IDeliveryOrder> {
    console.log("handleProviderWebhook", JSON.stringify(data));

    // Extract provider delivery ID from webhook data (different for each provider)
    let providerOrderId: string;
    let statusValue: string;

    if (provider === DeliveryProviderEnum.ADLOGGS) {
      // Adloggs webhook format: order_uuid and order_status_id (numeric)
      providerOrderId = data.order_uuid || data.partner_order_id;
      statusValue = data.order_status_id?.toString() || '2'; // Default to pending if missing
    } else {
      // Uber webhook format: delivery_id and status (string)
      providerOrderId = data.delivery_id;
      statusValue = data.status;
    }

    if (!providerOrderId) {
      throw new BadRequestException(`Provider order ID not found in webhook data`);
    }

    // Find our delivery order by provider's ID
    const deliveryOrder = await this.dbServices.deliveryOrder.findOne({ providerOrderId });

    if (!deliveryOrder) {
      throw new NotFoundException(`Delivery order with provider ID ${providerOrderId} not found`);
    }

    // Get the provider service
    const providerService = this.getProviderService(provider);

    // Update the delivery status based on webhook data
    const newStatus = providerService.mapProviderStatusToDeliveryStatus(statusValue);

    // Update our record with the new status
    const updatedDelivery = await this.dbServices.deliveryOrder.findOneAndUpdate(
      { deliveryId: deliveryOrder.deliveryId },
      {
        status: newStatus,
        updatedAt: new Date(),
        // Update other fields as needed based on webhook data
        providerResponse: data,
      },
      { new: true }
    );

    return updatedDelivery;
  }

  async checkDeliveryAvailability(dropoffAddress: any): Promise<any[]> {
    try {
      const formattedAddress = Helpers.parseAddress(dropoffAddress.address);
      const dropOffLocation: LocationInfo = {
        address: formattedAddress,
        coordinates: {
          latitude: dropoffAddress.location.coordinates[1], // Convert from [lng, lat] to {lat, lng}
          longitude: dropoffAddress.location.coordinates[0]
        }
      };
      // Fetch all branches
      const branches: any = await this.httpClientService.get('MENU_SERVICE', '/branch');
      const availableBranches: IBranchInfo[] = [];
      // Check each branch for delivery availability
      for (const branch of branches.items) {
        const pickupLocation: LocationInfo = {
          address: Helpers.parseAddress(branch.address),
          coordinates: {
            latitude: branch.location.coordinates[1],  // Convert from [lng, lat] to {lat, lng}
            longitude: branch.location.coordinates[0]
          }
        };

        try {
          // Use the default provider service
          const providerService = this.getProviderService(this.defaultProvider);
          const isAvailable = await providerService.checkDeliveryAvailability(
            pickupLocation,
            dropOffLocation,
            branch.branchId
          );

          if (isAvailable) {
            // If delivery is available, add branch to results
            availableBranches.push({
              branchId: branch.branchId,
              name: branch.name,
              address: branch.address,
              phone: branch.phone,
              email: branch.email
            });
          }
        } catch (error) {
          console.error(`Error checking delivery for branch ${branch.branchId}:`, error);
          // Continue checking other branches even if one fails
          continue;
        }
      }

      return availableBranches;

    } catch (error) {
      throw new BadRequestException(`Failed to check delivery availability: ${error.message}`);
    }
  }

  /**
   * Get delivery fee for a specific branch and dropoff location
   * Used by CartService to calculate delivery fee
   */
  async getDeliveryFee(
    pickupLocation: LocationInfo,
    dropoffLocation: LocationInfo,
    branchId: string
  ): Promise<number> {
    try {
      const branchDetails = await this.dbServices.branch.findOne({ branchId });

      if (branchDetails?.isDeliveryFree) {
        return 0;
      }

      const providerService = this.getProviderService(this.defaultProvider);
      const result = await providerService.checkDeliveryAvailability(
        pickupLocation,
        dropoffLocation,
        branchId
      );

      if (!result) {
        return 0;
      }

      // Adloggs returns estimated_price (number) directly
      if (this.defaultProvider === DeliveryProviderEnum.ADLOGGS) {
        return Number(result);
      }

      // Uber returns quote amount in cents, convert to dollars
      return Number(result) / 100;
    } catch (error) {
      // Re-throw HttpExceptions (like distance validation errors) so users see friendly messages
      if (error instanceof HttpException && error.getStatus() === HttpStatus.BAD_REQUEST) {
        throw error;
      }
      console.error(`Error getting delivery fee for branch ${branchId}:`, error);
      return 0;
    }
  }
}

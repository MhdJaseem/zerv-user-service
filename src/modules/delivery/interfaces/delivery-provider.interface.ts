import { DeliveryStatus } from '../../../common/enums/delivery.enum';
import { CreateDeliveryOrderDto } from '../dto/create-delivery-order.dto';
import { IDeliveryOrder, LocationInfo } from './delivery-order.interface';

export interface IDeliveryProvider {
  createDeliveryOrder(orderData: CreateDeliveryOrderDto): Promise<IDeliveryOrder>;
  getDeliveryStatus(deliveryId: string, branchId: string): Promise<DeliveryStatus>;
  cancelDelivery(deliveryId: string, branchId: string): Promise<boolean>;
  updateDeliveryStatus(deliveryId: string, status: DeliveryStatus, branchId: string): Promise<IDeliveryOrder>;
  mapProviderStatusToDeliveryStatus(providerStatus: string): DeliveryStatus;
  checkDeliveryAvailability(
    pickupLocation: LocationInfo,
    dropoffLocation: LocationInfo,
    branchId: string
  ): Promise<boolean>;
}

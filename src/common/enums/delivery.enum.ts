export enum DeliveryProviderEnum {
  UBER = 'uber',
  ADLOGGS = 'adloggs',
  DOORDASH = 'doordash',
  GRUBHUB = 'grubhub',
  // Add more providers as needed
}

export enum DeliveryStatus {
  CREATED = 'created',
  // ACCEPTED = 'accepted',
  PICKUP_READY = 'pickup_ready',
  PICKED_UP = 'picked_up',
  DROPOFF = 'readyToDeliver',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  RETURN = 'return', // RTO (Return to Origin) - for Adloggs
}

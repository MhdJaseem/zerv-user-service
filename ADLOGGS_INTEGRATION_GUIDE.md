# Adloggs Delivery Integration Guide

## Overview
This document describes the Adloggs delivery provider integration and how to test it.

## Configuration

### 1. Environment Variables
Add to your `.env` file:

```env
# Adloggs Configuration
ADLOGGS_DELIVERY_API=https://app.adloggs.com
# For development/testing use: https://dev.adloggs.com

# Optional: Set Adloggs as default provider
DEFAULT_DELIVERY_PROVIDER=adloggs
```

### 2. Branch Configuration
Each branch must have Adloggs credentials in the database. Update your branch schema to include:

```json
{
  "adloggsInfo": {
    "adloggsApiKey": "your-api-key-from-adloggs",
    "adloggsEnabled": true,
    "adloggsPartnerMerchantId": "optional-merchant-id-for-multi-branch"
  }
}
```

**To enable Adloggs for a branch:**
- Get API key from Adloggs
- Update branch document with the above `adloggsInfo` object
- Set `adloggsEnabled: true`

## API Endpoints Implemented

### 1. Create Order
**Endpoint:** `POST /aa/oporder/v2/create`

**Trigger:** Automatically called when order status changes to `PREPARING`

**Request Format:**
```json
{
  "partner_order_id": "ORDER123",
  "pickup_contact_name": "Restaurant Name",
  "pickup_contact_no": "1234567890",
  "pickup_address": "123 Main St, City, State, 12345",
  "pickup_lat": 12.9783692,
  "pickup_long": 77.6408356,
  "delivery_contact_name": "Customer Name",
  "delivery_contact_no": "9876543210",
  "delivery_address": "456 Oak Ave, City, State, 54321",
  "delivery_lat": 12.9583692,
  "delivery_long": 77.6408356,
  "order_category": "Food and Beverage",
  "order_total_price": "455.50",
  "order_total_weight_in_kg": "5.50",
  "items": [
    {
      "name": "Item Name",
      "quantity": "2",
      "price": "200.50"
    }
  ],
  "payment_type": "Online",
  "utc_offset": 330
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Order Created",
  "data": {
    "order_uuid": "ed573c62-d463-404c-b8ac-e1b433d648c9",
    "trackUrl": "https://app.adloggs.com/app/full/to?key=...",
    "fee": 85,
    "distance": 9.47
  }
}
```

### 2. Service Availability Check
**Endpoint:** `POST /aa/oporder/v1.2/service/availability`

**When Called:** Before order creation to check if delivery is available

**Request Format:**
```json
{
  "pickup_lat": 12.9783692,
  "pickup_long": 77.6408356,
  "pickup_pincode": "628621",
  "delivery_lat": 12.9583692,
  "delivery_long": 77.6408356,
  "delivery_pincode": "628621",
  "utc_offset": 330,
  "payment_type": "Online"
}
```

**Success Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Service available.",
  "data": {
    "service_available": true,
    "to_pickup": {
      "eta_min": 1
    },
    "distance": 1,
    "estimated_price": 59
  }
}
```

### 3. Get Order Status
**Endpoint:** `POST /aa/oporder/getcurrentstatus`

**Request:**
```json
{
  "order_uuid": "ed573c62-d463-404c-b8ac-e1b433d648c9"
}
```

**Response:**
```json
{
  "status": true,
  "code": 200,
  "message": "Success",
  "data": {
    "order_uuid": "ed573c62-d463-404c-b8ac-e1b433d648c9",
    "order_status_id": 3,
    "is_return": false,
    "deliveryStaffDetails": {
      "name": "Driver Name",
      "phone": "9500303975",
      "currentLocation": {
        "lat": "11.17910970",
        "long": "77.28852820"
      }
    }
  }
}
```

### 4. Cancel Order
**Endpoint:** `POST /aa/oporder/v1.2/cancel`

**Note:** Cannot cancel after pickup

**Request:**
```json
{
  "order_uuid": "ed573c62-d463-404c-b8ac-e1b433d648c9",
  "order_cancel_description": "Order cancelled by restaurant"
}
```

## Status Mapping

Adloggs uses numeric status IDs. Here's how they map to our internal statuses:

| Adloggs Status ID | Status Name | Internal Status | Description |
|-------------------|-------------|-----------------|-------------|
| 2 | Pending | CREATED | Order created, waiting for assignment |
| 3 | Assigned | PICKUP_READY | Rider assigned, heading to pickup |
| 11 | Arrived at pickup | PICKUP_READY | Rider at pickup location |
| 4 | Picked Up | PICKED_UP | Order picked up from restaurant |
| 9 | Out For Delivery | DROPOFF | Rider heading to customer |
| 8 | Arrived | DROPOFF | Rider at delivery location |
| 5 | Delivered | DELIVERED | Order delivered successfully |
| 6 | Cancelled | CANCELLED | Order cancelled |
| 13 | Return | RETURN | RTO initiated (customer unavailable) |
| 14 | RTO-Delivered | RETURN | Returned to origin |

## Testing the Integration

### Prerequisites
1. Get test API key from Adloggs (for dev.adloggs.com)
2. Configure at least one branch with Adloggs credentials
3. Ensure your order flow triggers delivery creation on `PREPARING` status

### Test Scenarios

#### Test 1: Check Service Availability
```bash
# Call your API endpoint that checks delivery availability
POST /api/delivery/check-availability
{
  "dropoffAddress": {
    "address": {
      "streetAddress": "123 Main St",
      "city": "City Name",
      "state": "State",
      "zipCode": "12345"
    },
    "location": {
      "coordinates": [77.6408356, 12.9783692]  // [lng, lat]
    }
  },
  "branchId": "your-branch-id"
}
```

**Expected:** Returns available branches with delivery fee estimates

#### Test 2: Create Delivery Order (Full Flow)
1. **Create an order with `orderType: 'delivery'`**
   ```bash
   POST /api/orders
   {
     "orderType": "delivery",
     "branchId": "branch-with-adloggs-enabled",
     "deliveryAddress": {
       "streetAddress": "456 Oak Ave",
       "city": "City",
       "state": "State",
       "zipCode": "54321",
       "latitude": 12.9583692,
       "longitude": 77.6408356
     },
     "items": [...],
     "paymentType": "online"
   }
   ```

2. **Change order status to `PREPARING`**
   - This automatically triggers Adloggs delivery creation
   - Check logs for: `📦 Creating Adloggs delivery order`

3. **Verify Response**
   - Order should have `deliveryOrderId` populated
   - Check `providerResponse` for Adloggs details

#### Test 3: Track Delivery Status
```bash
# Get order details
GET /api/orders/:orderId
```

**Expected Fields:**
- `deliveryOrderId` - Adloggs order UUID
- `trackingUrl` - Link to track delivery
- `deliveryFee` - Fee from Adloggs
- `deliveryStatus` - Current delivery status

#### Test 4: Cancel Delivery
```bash
# Cancel the order (only works before pickup)
PATCH /api/orders/:orderId/cancel
```

**Expected:**
- If before pickup: Success
- If after pickup: Error message from Adloggs

#### Test 5: Webhook Status Updates
Adloggs sends webhooks to update order status. Set up webhook endpoint:

```typescript
// Expected webhook payload from Adloggs
{
  "order_uuid": "ed573c62-d463-404c-b8ac-e1b433d648c9",
  "order_status_id": 3,
  "partner_order_id": "YOUR_ORDER_ID",
  "deliveryStaffDetails": {
    "name": "Driver Name",
    "phone": "9090909090",
    "currentLocation": {
      "lat": "11.17910110",
      "long": "77.28851930"
    }
  },
  "eta": {
    "to_pickup": 5
  },
  "rider_platform": {
    "name": "Adloggs",
    "lsp_uniq_id": "CRN1361694246"
  }
}
```

### Manual Testing Checklist

- [ ] Branch has Adloggs credentials configured
- [ ] Environment variable `ADLOGGS_DELIVERY_API` is set
- [ ] Service availability check returns results
- [ ] Order creation with delivery type works
- [ ] Delivery order is created when status = PREPARING
- [ ] Order has `deliveryOrderId` and `trackingUrl`
- [ ] Delivery fee is calculated correctly
- [ ] Order status updates via webhook
- [ ] Driver details appear when assigned
- [ ] Cancel before pickup works
- [ ] Cancel after pickup is rejected
- [ ] Final status (delivered/cancelled) updates order

## Debugging

### Enable Detailed Logging
The service logs all API calls with detailed information:

```
📦 Creating Adloggs delivery order for: ORDER123
✅ Adloggs order created successfully
🔍 Checking Adloggs delivery availability
❌ Adloggs API error: [error details]
```

### Common Issues

#### 1. "Adloggs delivery is not enabled for this branch"
**Solution:** Update branch document with `adloggsInfo.adloggsEnabled: true`

#### 2. "Auth Error" / "Api key have auth issue"
**Solution:** Verify API key is correct and active

#### 3. "Riders not available"
**Solution:** Check if location is serviceable by Adloggs, or try during peak hours

#### 4. "Order already picked up" (on cancel)
**Solution:** Cannot cancel after pickup - this is expected behavior

#### 5. "Currently service not available in the location"
**Solution:** The delivery address is outside Adloggs service area

#### 6. "Distance too long"
**Solution:** Distance between pickup and delivery exceeds Adloggs limits

## Differences from Uber Integration

| Feature | Uber | Adloggs |
|---------|------|---------|
| Authentication | OAuth 2.0 (token-based) | API Key |
| Status Format | String values | Numeric IDs (2-14) |
| API Base URL | `https://api.uber.com` | `https://app.adloggs.com` |
| Endpoints | RESTful paths | `/aa/oporder/*` paths |
| Cancel After Pickup | Allowed with fee | Not allowed |
| RTO (Return to Origin) | Not available | Available (status 13, 14) |

## Production Checklist

Before going live with Adloggs:

- [ ] Switch to production API URL: `https://app.adloggs.com`
- [ ] Get production API keys from Adloggs
- [ ] Update all branch configurations with production keys
- [ ] Test webhook endpoint is accessible from Adloggs servers
- [ ] Configure webhook authentication if required
- [ ] Set up monitoring for failed delivery creations
- [ ] Test order flows in production environment
- [ ] Verify COD (Cash on Delivery) flow if applicable
- [ ] Document operational procedures for support team

## Support

For Adloggs API issues:
- Contact Adloggs support with your partner account details
- Provide `partner_order_id` or `order_uuid` for specific issues
- Check Adloggs dashboard for order status and logs

For integration code issues:
- Check logs in your application
- Review `src/modules/delivery/providers/adloggs-delivery.service.ts`
- Verify branch configuration in database


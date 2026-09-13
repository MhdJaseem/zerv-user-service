import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { IOrder, IAddressDetails } from '../../common/interfaces/order.interface';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { ICart } from 'src/common/interfaces/cart.interface';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { OrderPageEnum, OrderStatus, OrderTypeEnum, UserTypeEnum } from 'src/common/enums/user.enum';
import { CurrencyEnum, PaymentModeEnum, PaymentStatusEnum, PaymentTypeEnum } from 'src/common/enums/payment.enums';
import { CreateBranchPaymentDto } from './dto/create-branch-payment.dto';
import { DeliveryService } from '../delivery/delivery.service';
import { DeliveryStatus } from 'src/common/enums/delivery.enum';
import { IDeliveryOrder } from '../delivery/interfaces/delivery-order.interface';
import { CreateDeliveryOrderDto } from '../delivery/dto/create-delivery-order.dto';
import { IPayment, IPaymentInfo } from 'src/common/interfaces/payment.interface';
import { OrderStatsQueryDto } from './dto/order-stats.dto';
import { OrderStats } from 'src/common/interfaces/order.interface';
import { OrderExportData } from 'src/common/interfaces/order.interface';
import { DailySales } from 'src/common/interfaces/order.interface';
import { OrderStatsWithComparison } from 'src/common/interfaces/order.interface';
import momentTz from 'moment-timezone';
import { EmailService } from '../email/email.service';
import { ActionLogService } from '../../common/shared/action-log/actionLog.service';
import { CollectionNames } from 'src/common/enums/common.enum';
import { IRewardTransactionLog } from 'src/common/interfaces/reward.interface';
import { RewardAdjustmentTypes } from 'src/common/enums/reward.enum';
import { Parser } from 'json2csv';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from '../auth/auth.service';
import { customAlphabet, nanoid } from 'nanoid';
import { ALPHABET, ASIA_CALCUTTA_TIMEZONE } from 'src/common/constants/common.constants';
import { CouponRedeemedStatus } from '../../common/enums/cart.enum';
import { Cron } from '@nestjs/schedule';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { MongoViewService } from 'src/common/services/mongo-view.service';

@Injectable()
export class OrdersService {
  constructor(
    private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly httpClientService: HttpClientService,
    private readonly deliveryService: DeliveryService,
    private readonly emailService: EmailService,
    private actionLogService: ActionLogService,
    private authService: AuthService,
    private readonly mongoViewService: MongoViewService,
    // @InjectConnection() private connection: Connection,
  ) { }

  // Generate ID where first character is a letter, rest is a normal nanoid
  async generateOrderId(): Promise<string> {
    const totalOrders = await this.dbServices.order.countDocuments({});

    let nanoIdLength = 5;
    if (totalOrders >= 500000) {
      nanoIdLength = 6 + Math.floor((totalOrders - 500000) / 500000);
    }

    const firstChar = customAlphabet(ALPHABET, 1)();

    while (true) {
      const rest = nanoid(nanoIdLength);
      const orderId = firstChar + rest;

      const existing = await this.dbServices.order.findOne({ orderId });
      if (!existing) {
        return orderId;
      }
    }
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      // Set default order status
      const orderStatus = OrderStatus.PENDING;
      let guestUser;
      let addressDetails: any = {
        streetAddress: [],
        city: '',
        state: '',
        zipCode: '',
        country: '',
      };
      if (createOrderDto?.address) {
        addressDetails = await this.parseAddress(createOrderDto.address.streetAddress);
        addressDetails.apartment = createOrderDto?.address?.apartment || '';
      }

      // Extract coordinates from address.location.coordinates
      const coordinates = createOrderDto?.address?.location?.coordinates;
      let user = await this.dbServices.user.findOne({ phoneNumber: createOrderDto?.customerInfo?.phoneNumber, restaurantId: createOrderDto.restaurantId });

      // If user not found by phoneNumber + restaurantId, check if user exists by userId
      if (!user && createOrderDto.userId) {
        user = await this.dbServices.user.findOne({ userId: createOrderDto.userId });
      }

      if (!user) {
        if (!createOrderDto.customerInfo) {
          throw new BadRequestException('CustomerInfo is required for guest user');
        }
        // Create guest user
        try {
          guestUser = await this.dbServices.user.create({ userId: createOrderDto.userId, restaurantId: createOrderDto.restaurantId, userType: UserTypeEnum.Guest, ...createOrderDto.customerInfo });
          createOrderDto.userId = guestUser.userId;
          await this.authService.signUpUserInCognito(
            guestUser?.phoneNumber,
            guestUser?.firstName + ' ' + guestUser?.lastName,
            guestUser?.userId,
            guestUser?.email, // Pass email to Cognito signup
          );
        }
        catch (error) {
          // Check if error is due to duplicate userId
          if (error.code === 11000 && error.keyPattern?.userId) {
            // User with this userId already exists, fetch it instead
            user = await this.dbServices.user.findOne({ userId: createOrderDto.userId });
            if (user) {
              createOrderDto.userId = user.userId;
            } else {
              throw new BadRequestException('Failed to create guest user: User ID already exists but could not be retrieved');
            }
          } else {
            throw new BadRequestException('Failed to create guest user: ' + error.message);
          }
        }
      } else {
        // User exists, ensure userId is set correctly
        createOrderDto.userId = user.userId;
      }
      // Original cart finding logic
      const cart: ICart = await this.dbServices.cart.findOne({ userId: createOrderDto.userId });
      if (!cart) {
        throw new NotFoundException(`Cart not found for user with ID ${createOrderDto.userId}`);
      }
      // Validate order time before proceeding
      const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${cart?.branchId}`);
      if (!branch) {
        throw new NotFoundException(`Branch not found with ID ${cart?.branchId}`);
      }
      // Validate if order time is within branch operating hours
      const validationResult = this.validateOrderTime(createOrderDto, branch, cart);
      if (!validationResult.success) {
        throw new BadRequestException(validationResult.message);
      }
      if (createOrderDto.hasOwnProperty('getPromotionalEmails') && createOrderDto.hasOwnProperty('getPromotionalTexts')) {
        await this.dbServices.user.findOneAndUpdate(
          { userId: (guestUser?.userId) ? guestUser.userId : user.userId },
          { $set: { getPromotionalEmails: createOrderDto.getPromotionalEmails, getPromotionalTexts: createOrderDto.getPromotionalTexts } }
        );
      }
      //create address for guest user, if the orderType is Delivery
      if (cart.orderType === OrderTypeEnum.DELIVERY) {
        const address = await this.dbServices.address.findOne({ userId: createOrderDto.userId });
        if (!address) {
          // Create new address with location
          await this.dbServices.address.create({
            userId: (guestUser?.userId) ? guestUser.userId : user.userId,
            ...addressDetails,
            location: {
              type: 'Point',
              coordinates: coordinates || [0, 0]
            }
          });
        } else {
          // Update existing address with location
          await this.dbServices.address.findOneAndUpdate(
            { userId: (guestUser?.userId) ? guestUser.userId : user.userId },
            {
              ...addressDetails,
              location: {
                type: 'Point',
                coordinates: coordinates || address.location?.coordinates || [0, 0]
              }
            },
            { new: true }
          );
        }
      }

      const customerInfo = {
        name: (guestUser)
          ? guestUser.firstName + ' ' + guestUser.lastName
          : user.firstName + ' ' + user.lastName,
        email: (guestUser) ? guestUser.email : user.email,
        phoneNumber: (guestUser) ? guestUser.phoneNumber : user.phoneNumber
      }

      const { items, subtotal, taxes, total, roundOff, platformFee, deliveryFee } = cart;
      let deliveryTipAmount = 0;
      if (createOrderDto?.deliveryTipAmount) {
        deliveryTipAmount = createOrderDto?.deliveryTipAmount;
      }
      const finalTotal = Number((total + deliveryTipAmount + (deliveryFee || 0)).toFixed(2));

      const finalOrder: any = {
        ...createOrderDto,
        orderStatus,
        branchId: cart.branchId,
        items,
        pointsToBeRedeemed: cart.pointsToBeRedeemed,
        totalPointsToBeAdded: cart.totalPointsToBeAdded,
        orderType: cart.orderType, // Store the order type to know if it's delivery or pickup
        total: finalTotal,
        subtotal,
        taxes,
        address: {
          ...addressDetails,
          location: {
            type: 'Point',
            coordinates: coordinates || [0, 0]
          }
        },
        customerInfo,
        platformFee,
        deliveryFee,
        specialInstruction: createOrderDto.specialInstruction ? createOrderDto.specialInstruction : cart.specialInstruction,
        includeUtensils: createOrderDto.includeUtensils ? createOrderDto.includeUtensils : cart.includeUtensils,
        orderDate: momentTz.tz(
          createOrderDto?.orderDate,
          branch.timezone
        ).startOf('day').clone().utc().toDate(),
        orderTime: cart.orderTime ? cart.orderTime : createOrderDto?.orderTime,
        orderId: await this.generateOrderId(),
        couponCode: cart.couponCode,
        couponDiscountAmount: cart.couponDiscountAmount,
      };

      const paymentDetail: CreateBranchPaymentDto = {
        paymentMode: PaymentModeEnum.ONLINE,
        paymentType: PaymentTypeEnum.PAYMENT,
        billDetails: {
          netAmount: subtotal,
          totalTax: taxes,
          roundOff: roundOff,
          grandTotal: finalTotal,
          deliveryTipAmount: deliveryTipAmount,
        },
        isPaid: false,
        remarks: '',
        email: user?.email || guestUser?.email || '',
        mobile: user?.phoneNumber || guestUser?.phoneNumber || '',
        customerId: user?.userId || guestUser?.userId || '',
        amount: finalTotal,
        currency: CurrencyEnum.INR,
        status: PaymentStatusEnum.PAYMENT_CREATED,
        branchId: cart.branchId,
        customerName: user
          ? user?.firstName + ' ' + user?.lastName
          : guestUser?.firstName + ' ' + guestUser?.lastName,
      };

      let createdPaymentDetail: IPayment;
      if (total > 0) {
        createdPaymentDetail = await this.httpClientService.post(
          'PAYMENT_SERVICE',
          '/payments/restaurant',
          paymentDetail
        ) as unknown as IPayment;
        finalOrder['paymentId'] = createdPaymentDetail.paymentId;
      } else {
        createdPaymentDetail = await this.httpClientService.post(
          'PAYMENT_SERVICE',
          '/payments',
          paymentDetail
        ) as unknown as IPayment;
        const asapOrder = createOrderDto.orderTime.from === createOrderDto.orderTime.to;
        if (branch?.autoAcceptOrder) {
          if (asapOrder) {
            finalOrder['orderStatus'] = OrderStatus.PREPARING;
          }
          else {
            finalOrder['orderStatus'] = OrderStatus.ACCEPTED;
          }
        }
        else {
          finalOrder['orderStatus'] = OrderStatus.PLACED;
        }
        finalOrder['paymentId'] = createdPaymentDetail.paymentId;

        if ((finalOrder.pointsToBeRedeemed > 0) && (user?.userType == UserTypeEnum.CUSTOMER)) {
          console.log('🔄 Starting reward point redemption process');
          console.log('🧾 Order Info:', {
            orderId: finalOrder.orderId,
            userId: finalOrder.userId,
            restaurantId: finalOrder.restaurantId,
            pointsToBeRedeemed: finalOrder.pointsToBeRedeemed,
            userType: user.userType,
          });
          try {
            const rewardUpdateResult = await this.dbServices.reward.findOneAndUpdate(
              { userId: finalOrder.userId, restaurantId: finalOrder.restaurantId },
              { $inc: { rewardPoints: -finalOrder.pointsToBeRedeemed } },
              { upsert: true, new: true },
            );

            if (!rewardUpdateResult) {
              console.error('⚠️ No reward document matched or created during upsert!');
            } else {
              console.log('✅ Reward points updated successfully:', rewardUpdateResult.rewardPoints);
            }

            const rewardLog: IRewardTransactionLog = {
              userId: finalOrder.userId,
              adjustType: RewardAdjustmentTypes.SUBTRACT,
              quantity: finalOrder.pointsToBeRedeemed,
              reason: 'rewards redeemed for the order',
              adjustedBy: 'admin',
              restaurantId: finalOrder.restaurantId,
              orderId: finalOrder.orderId,
            };
            const logResult = await this.dbServices.rewardTransactionLog.create(rewardLog);
            console.log('📝 Reward transaction log created:', logResult._id);
            await this.dbServices.cart.findOneAndDelete({ userId: finalOrder.userId });
          } catch (error) {
            console.error('Error redeeming rewards:', error.message);
          }
        }
      }

      if (cart.couponCode) {
        await this.createCouponLog(
          createOrderDto.userId,
          cart.branchId,
          cart.couponCode,
          cart.couponDiscountAmount || 0,
          cart.couponExpiryDate ? String(cart.couponExpiryDate) : ''
        );
      }
      // Create the order in the database
      const order = await this.dbServices.order.create(finalOrder);

      // Log order creation in action logs
      await this.actionLogService.logCreateAction(
        CollectionNames.ORDERS,
        order,
        order.orderId,
        {
          entityType: 'user',
          entityId: order.userId,
          entityName: 'customer'
        }
      );

      return { order, gatewayOrderId: createdPaymentDetail?.gatewayOrderId, clientSecret: createdPaymentDetail?.clientSecret };
    } catch (error) {
      throw new BadRequestException('Failed to create order: ' + error.message);
    }
  }

  /**
   * Validates if an order can be placed based on branch operating hours
   * @param {CreateOrderDto} orderData - The order data containing date and time fields
   * @param {any} branchData - The branch data containing operating hours
   * @returns {Object} - Validation result with success status and message
   */
  private validateOrderTime(orderData: CreateOrderDto, branchData: any, cart) {
    // Check if required data is present
    if (!orderData || !branchData) {
      return { success: false, message: "Missing order or branch data" };
    }

    if (!orderData.orderDate || !orderData.orderTime || !orderData.orderTime.from || !cart.orderType) {
      return { success: false, message: "Order is missing required fields: orderDate, orderTime or orderType" };
    }

    // Check if this is an ASAP order (from and to times are the same)
    const isAsapOrder = orderData.orderTime.from === orderData.orderTime.to;

    // Rest of the existing validation logic
    let orderMoment;
    try {
      const orderDateMoment = momentTz.tz(orderData.orderDate, branchData.timezone);
      const [hours, minutes] = orderData.orderTime.from.split(':').map(Number);
      orderMoment = orderDateMoment.hour(hours).minute(minutes).second(0);

      // Check if date is valid
      if (!orderMoment.isValid()) {
        return { success: false, message: "Invalid order date/time format" };
      }

      // Handle ASAP orders - update orderDate to current date if different
      if (isAsapOrder) {
        const currentMoment = momentTz.tz(branchData.timezone);
        const orderDateOnly = orderMoment.clone().startOf('day');
        const currentDateOnly = currentMoment.clone().startOf('day');

        // If order date is different from current date, update it to current date
        if (!orderDateOnly.isSame(currentDateOnly, 'day')) {
          // Update the orderDate in the orderData to current date (as string)
          orderData.orderDate = currentDateOnly.format('YYYY-MM-DD');
          orderMoment = currentMoment.clone().hour(hours).minute(minutes).second(0);
        }
      } else {
        // For non-ASAP orders, check if order date is in the past
        const currentMoment = momentTz.tz(branchData.timezone);
        if (orderMoment.isBefore(currentMoment, 'day')) {
          return {
            success: false,
            message: "Order date cannot be in the past. Please select today's date or a future date."
          };
        }

        // For same day orders, check if the time has already passed (only for non-ASAP orders)
        if (orderMoment.isSame(currentMoment, 'day') && orderMoment.isBefore(currentMoment)) {
          return {
            success: false,
            message: "Order time has already passed. Please select a future time."
          };
        }
      }

    } catch (error) {
      return { success: false, message: "Invalid order date/time format: " + error.message };
    }

    // Skip operating hours validation if from and to times are the same (ASAP orders)
    if (isAsapOrder) {
      return { success: true, message: "ASAP order - skipping operating hours validation" };
    }

    // Get day of week using momentTz (0 = Sunday, 1 = Monday, etc.)
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayOfWeek = daysOfWeek[orderMoment.day()];

    // Get formatted time string from the order moment
    const orderTimeString = orderMoment.format('HH:mm');

    // Determine which hours to check based on order type
    let hoursToCheck;
    if (cart.orderType.toLowerCase() === OrderTypeEnum.PICKUP) {
      hoursToCheck = branchData.hours.pickupHours;
    } else if (cart.orderType.toLowerCase() === OrderTypeEnum.DELIVERY) {
      hoursToCheck = branchData.hours.deliveryHours;
    } else {
      return { success: false, message: "Invalid order type. Must be 'pickup' or 'delivery'" };
    }

    // Find the hours for the specific day
    const dayHours = hoursToCheck.find(h => h.day === dayOfWeek);

    if (!dayHours) {
      return { success: false, message: `No ${cart.orderType} hours defined for ${dayOfWeek}` };
    }

    // Check if store is closed on that day
    if (dayHours.isClosed) {
      return {
        success: false,
        message: `Branch is closed for ${cart.orderType} on ${dayOfWeek}`
      };
    }

    // Check if order time is within any of the active hour ranges
    if (!dayHours.activeHours || dayHours.activeHours.length === 0) {
      return {
        success: false,
        message: `No active hours defined for ${cart.orderType} on ${dayOfWeek}`
      };
    }

    // Check if the order time falls within any of the active hour ranges
    const isWithinActiveHours = dayHours.activeHours.some(timeRange => {
      return orderTimeString >= timeRange.open && orderTimeString <= timeRange.close;
    });

    if (!isWithinActiveHours) {
      // Format all available time slots for the error message
      const availableHours = dayHours.activeHours
        .map(timeRange => `${timeRange.open} - ${timeRange.close}`)
        .join(', ');

      return {
        success: false,
        message: `Order time (${orderTimeString}) is outside ${cart.orderType} hours (${availableHours}) for ${dayOfWeek}`
      };
    }

    return {
      success: true,
      message: `Order time is valid for ${cart.orderType} on ${dayOfWeek}`
    };
  }

  private parseAddress(address: string) {
    const addressParts = address.split(", ");//17 W 33rd St, New York, NY 10118, USA
    if (addressParts.length < 3) {
      throw new Error("Invalid address format");
    }

    const street = addressParts[0];
    const city = addressParts[1];
    const stateZipCountry = addressParts[2].split(" ");

    const state = stateZipCountry[0];
    const zipCode = stateZipCountry[1];
    const country = addressParts.length > 3 ? addressParts[3] : "US";

    return {
      streetAddress: [street],
      city: city,
      state: state,
      zipCode: zipCode,
      country: country
    };
  }

  async getAllOrdersManagerOrders(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean,
  ): Promise<IPaginatedResult<IOrder[]>> {
    if (filter.orderDate) {
      const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${filter?.branchId}`);

      if (branch?.timezone) {
        const timezone = branch.timezone;

        // Handle date range
        if (filter.orderDate.from && filter.orderDate.to) {
          const fromDate = momentTz.tz(filter.orderDate.from, 'YYYY-MM-DD', timezone).startOf('day').toDate();
          const toDate = momentTz.tz(filter.orderDate.to, 'YYYY-MM-DD', timezone).endOf('day').toDate();

          filter.orderDate = {
            $gte: fromDate,
            $lte: toDate
          };
        } else {
          // Handle single date
          const parsedDate = momentTz.tz(filter.orderDate, 'YYYY-MM-DD', timezone);
          const startDate = parsedDate.clone().startOf('day').toDate();
          const endDate = parsedDate.clone().endOf('day').toDate();

          filter.orderDate = {
            $gte: startDate,
            $lte: endDate
          };
        }
      }
    }

    const orders = await this.paginationService.findAndPaginate(
      this.dbServices.order,
      {
        skip,
        limit,
        filter,
        nonPaginated
      }
    );
    return orders;
  }

  async findAllOrders(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean,
  ): Promise<IPaginatedResult<IOrder[]>> {
    const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${filter?.branchId}`);

    if (filter.orderDate) {
      if (branch?.timezone) {
        const timezone = branch.timezone;

        // Handle date range
        if (filter.orderDate.from && filter.orderDate.to) {
          const fromDate = momentTz.tz(filter.orderDate.from, 'YYYY-MM-DD', timezone).startOf('day').toDate();
          const toDate = momentTz.tz(filter.orderDate.to, 'YYYY-MM-DD', timezone).endOf('day').toDate();

          filter.orderDate = {
            $gte: fromDate,
            $lte: toDate
          };
        } else {
          // Handle single date
          const parsedDate = momentTz.tz(filter.orderDate, 'YYYY-MM-DD', timezone);
          const startDate = parsedDate.clone().startOf('day').toDate();
          const endDate = parsedDate.clone().endOf('day').toDate();

          filter.orderDate = {
            $gte: startDate,
            $lte: endDate
          };
        }
      }
    }

    // Handle createdAt date conversion
    if (filter.createdAt) {
      if (branch?.timezone) {
        const timezone = branch.timezone;

        // Handle date range
        if (filter.createdAt.from && filter.createdAt.to) {
          const fromDate = momentTz.tz(filter.createdAt.from, 'YYYY-MM-DD', timezone).startOf('day').toDate();
          const toDate = momentTz.tz(filter.createdAt.to, 'YYYY-MM-DD', timezone).endOf('day').toDate();

          filter.createdAt = {
            $gte: fromDate,
            $lte: toDate
          };
        } else {
          // Handle single date
          const parsedDate = momentTz.tz(filter.createdAt, 'YYYY-MM-DD', timezone);
          const startDate = parsedDate.clone().startOf('day').toDate();
          const endDate = parsedDate.clone().endOf('day').toDate();

          filter.createdAt = {
            $gte: startDate,
            $lte: endDate
          };
        }
      }
    }

    const orders = await this.paginationService.findAndPaginate(
      this.dbServices.order,
      {
        skip,
        limit,
        filter,
        nonPaginated
      }
    );

    if (!nonPaginated && orders.items.length > 0) {
      // Extract payment IDs from orders
      const paymentIds = orders.items
        .filter(order => order.paymentId)
        .map(order => order.paymentId);

      if (paymentIds.length > 0) {
        // Fetch all payment details in a single API call
        const payments: IPayment[] = await this.httpClientService.get(
          'PAYMENT_SERVICE',
          `/payments/by-ids?ids=${JSON.stringify(paymentIds)}`
        ) as unknown as IPayment[];

        // Create a map of payment details for quick lookup
        const paymentMap = new Map(
          payments.map(payment => [payment.paymentId, payment])
        );

        // Map payment details to orders
        orders.items = orders.items.map(order => {
          const paymentDetail = paymentMap.get(order.paymentId || '');
          if (paymentDetail) {
            order.paymentInfo = {
              paymentStatus: paymentDetail.status,
              totalRefundAmount: paymentDetail.totalRefundAmount || 0,
              payout: paymentDetail.payout || 0,
              processingFee: paymentDetail.processingFee || 0
            };
          }
          return order;
        });
      }
    }

    return orders;
  }

  async findById(orderId: string) {
    try {
      const order = await this.dbServices.order.findOne({
        orderId,
        isDeleted: { $in: [null, false] },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }
      const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${order?.branchId}`);

      if (!branch) {
        throw new NotFoundException(`Branch with ID ${order?.branchId} not found`);
      }
      const paymentDetail: IPayment = await this.httpClientService.get('PAYMENT_SERVICE', `/payments/${order?.paymentId}`) as unknown as IPayment;
      order['paymentStatus'] = paymentDetail?.status;
      order['totalRefundAmount'] = paymentDetail?.totalRefundAmount ? paymentDetail?.totalRefundAmount : 0;
      order['payout'] = paymentDetail?.payout ? paymentDetail?.payout : 0;
      order['processingFee'] = paymentDetail?.processingFee ? paymentDetail?.processingFee : 0;

      const branchInfo = {
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        timezone: branch.timezone,
        branchId: branch.branchId,
      };
      return { ...order, branchInfo }; // Merging order and branchInfo

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch order: ' + error.message);
    }
  }

  async update(orderId: string, updateOrderDto: UpdateOrderDto) {
    try {
      const originalOrder: IOrder = await this.dbServices.order.findOne({ orderId });
      if (!originalOrder) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }
      if (updateOrderDto.orderStatus === OrderStatus.PREPARING && originalOrder.orderType === OrderTypeEnum.DELIVERY) {
        const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${originalOrder?.branchId}`);

        // Handle delivery order creation asynchronously to prevent blocking order status update
        this.handleDeliveryOrderCreation(originalOrder, branch).catch(error => {
          console.error(`Failed to create delivery order for order ${originalOrder.orderId}:`, error.message);
          // Log the error but don't let it affect the order status update
        });
      }

      if (updateOrderDto.orderStatus === OrderStatus.ORDER_COMPLETED && originalOrder?.orderStatus !== OrderStatus.ORDER_COMPLETED) {
        // Add reward points for completed delivery.
        const order = originalOrder;
        if (originalOrder.total && originalOrder.total > 0) {
          if (order && order.totalPointsToBeAdded > 0) {
            await this.dbServices.reward.findOneAndUpdate(
              { userId: order.userId },
              {
                $inc: {
                  rewardPoints: order.totalPointsToBeAdded,
                },
                restaurantId: originalOrder.restaurantId,
              },
              { upsert: true, new: true },
            );
            const rewardLog: IRewardTransactionLog = {
              userId: order.userId,
              adjustType: RewardAdjustmentTypes.ADD,
              quantity: order.totalPointsToBeAdded,
              reason: 'rewards added for the completed order',
              adjustedBy: 'admin',
              restaurantId: originalOrder.restaurantId,
              orderId: originalOrder.orderId,
            };
            await this.dbServices.rewardTransactionLog.create(rewardLog);
          }

          if (order && order.pointsToBeRedeemed > 0) {
            await this.dbServices.reward.findOneAndUpdate(
              { userId: order.userId },
              {
                $inc: {
                  rewardPoints: -order.pointsToBeRedeemed,
                },
                restaurantId: originalOrder.restaurantId,
              },
              { upsert: true, new: true },
            );
            const rewardLog: IRewardTransactionLog = {
              userId: order.userId,
              adjustType: RewardAdjustmentTypes.SUBTRACT,
              quantity: order.pointsToBeRedeemed,
              reason: 'rewards deducted for the redeemed order',
              adjustedBy: 'admin',
              restaurantId: originalOrder.restaurantId,
              orderId: originalOrder.orderId,
            };
            await this.dbServices.rewardTransactionLog.create(rewardLog);
          }
        }
      }

      const updatedOrder = await this.dbServices.order.findOneAndUpdate(
        { orderId },
        updateOrderDto,
        { new: true }
      );

      // Log order update in action logs
      await this.actionLogService.logUpdateAction(
        CollectionNames.ORDERS,
        originalOrder,
        updatedOrder,
        orderId,
        {
          entityType: 'system',
          entityName: 'order-service',
        }
      );

      return updatedOrder;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update order: ' + error.message);
    }
  }

  async updateOrderFromDelivery(deliveryOrder: IDeliveryOrder): Promise<IOrder> {
    try {
      // Map delivery status to order status
      let orderStatus = "";
      switch (deliveryOrder.status) {
        case DeliveryStatus.PICKUP_READY:
          orderStatus = OrderStatus.RIDER_ASSIGNED;
          break;
        case DeliveryStatus.DROPOFF:
          orderStatus = OrderStatus.READY_FOR_PICKUP;
          break;
        case DeliveryStatus.DELIVERED:
          orderStatus = OrderStatus.ORDER_COMPLETED;
          // Add reward points for completed delivery
          const order = await this.dbServices.order.findOne({ orderId: deliveryOrder.orderId });
          if (order && order.totalPointsToBeAdded > 0) {
            await this.dbServices.reward.findOneAndUpdate(
              { userId: order.userId },
              {
                $inc: {
                  rewardPoints: order.totalPointsToBeAdded,
                },
                restaurantId: order.restaurantId,
              },
              { upsert: true, new: true },
            );
            const rewardLog: IRewardTransactionLog = {
              userId: order.userId,
              adjustType: RewardAdjustmentTypes.ADD,
              quantity: order.totalPointsToBeAdded,
              reason: 'rewards added for the completed Delivery order',
              adjustedBy: 'admin',
              restaurantId: order.restaurantId,
              orderId: order.orderId,
            };
            await this.dbServices.rewardTransactionLog.create(rewardLog);
          }
          break;
        case DeliveryStatus.CANCELLED:
          orderStatus = OrderStatus.CANCELLED;
          break;
        case DeliveryStatus.RETURN:
          // Handle RTO (Return to Origin) - could map to a specific status or keep as is
          break;
        case DeliveryStatus.FAILED:
          // Handle based on business rules - might require manual intervention
          break;
      }

      if (orderStatus) {
        // Get original order for logging
        const originalOrder = await this.dbServices.order.findOne({ orderId: deliveryOrder.orderId });

        const updatedOrder = await this.dbServices.order.findOneAndUpdate(
          { orderId: deliveryOrder.orderId },
          { orderStatus },
          { new: true }
        );

        // Log order update from delivery service
        await this.actionLogService.logUpdateAction(
          CollectionNames.ORDERS,
          originalOrder,
          updatedOrder,
          deliveryOrder.orderId,
          {
            entityType: 'service',
            entityName: 'delivery-service'
          }
        );

        return updatedOrder;
      }

      // If no status mapping, just return the current order
      return await this.dbServices.order.findOne({ orderId: deliveryOrder.orderId });
    } catch (error) {
      throw new BadRequestException(`Failed to update order from delivery: ${error.message}`);
    }
  }


  async confirmOrder(paymentId: string): Promise<IOrder> {
    try {
      // Find the order by paymentId
      const order = await this.dbServices.order.findOne({ paymentId });
      if (!order) {
        throw new NotFoundException(`Order with payment ID ${paymentId} not found`);
      }

      // Store original state for logging
      const originalOrder = { ...order };

      // Update order status from PENDING to PLACED
      let updateData: Partial<IOrder> = { orderStatus: OrderStatus.PLACED };

      // Check if restaurant has auto-accept enabled
      const restaurantData: any = await this.httpClientService.get(
        'MENU_SERVICE',
        `/restaurants/${order.restaurantId}`
      );

      if (restaurantData && restaurantData.settings && restaurantData.settings.autoAcceptOrders) {
        // If auto-accept is enabled, directly set status to ACCEPTED
        updateData.orderStatus = OrderStatus.ACCEPTED;
      }

      // Update the order with new status
      const updatedOrder = await this.dbServices.order.findOneAndUpdate(
        { orderId: order.orderId },
        updateData,
        { new: true }
      );

      // Log order confirmation
      await this.actionLogService.logUpdateAction(
        CollectionNames.ORDERS,
        originalOrder,
        updatedOrder,
        order.orderId,
        {
          entityType: 'service',
          entityName: 'payment-service'
        }
      );

      return updatedOrder;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to confirm order: ${error.message}`);
    }
  }

  async delete(orderId: string) {
    const order = await this.dbServices.order.findOne({ orderId });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const deletedOrder = await this.dbServices.order.findOneAndDelete({ orderId });

    // Log order deletion
    await this.actionLogService.logDeleteAction(
      CollectionNames.ORDERS,
      order,
      orderId,
      {
        entityType: 'system',
        entityName: 'order-service'
      }
    );

    return deletedOrder;
  }

  async updatePaymentStatus(paymentId: string, paymentInfo: IPaymentInfo) {
    try {
      const order = await this.dbServices.order.findOne({ paymentId });
      if (!order) {
        throw new NotFoundException(`Order with paymentId ${paymentId} not found`);
      }

      const user = await this.dbServices.user.findOne({ userId: order.userId });
      const paymentStatus = paymentInfo?.paymentStatus;

      if (paymentStatus === PaymentStatusEnum.PAYMENT_COMPLETED) {
        const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${order.branchId}`);
        const branchEmail = branch.email;
        const asapOrder = order.orderTime.from === order.orderTime.to;

        if (branch?.autoAcceptOrder) {
          if (asapOrder) {
            order.orderStatus = OrderStatus.PREPARING;

            // Handle delivery order creation asynchronously to prevent blocking order status update
            if (order.orderType === OrderTypeEnum.DELIVERY) {
              this.handleDeliveryOrderCreation(order, branch).catch(error => {
                console.error(`Failed to create delivery order for order ${order.orderId}:`, error.message);
                // Log the error but don't let it affect the order status update
              });
            }
          } else {
            order.orderStatus = OrderStatus.ACCEPTED;
          }
        } else {
          order.orderStatus = OrderStatus.PLACED;
        }

        // Update coupon status to REDEEMED when payment is successful
        if (order.couponCode) {
          await this.dbServices.couponlog.findOneAndUpdate(
            { couponCode: order.couponCode, userId: order.userId },
            { $set: { redeemedStatus: CouponRedeemedStatus.REDEEMED, couponDiscountAmount: order.couponDiscountAmount } }
          );
        }

        // Send email notification in a non-blocking manner
        if (user && user.email) {
          (async () => {
            try {
              const emailSubject = `Order Confirmation - #${order.orderId}`;
              const webConfig = await this.httpClientService.get('MENU_SERVICE', `/website-config/${order.restaurantId}`);
              const restaurant = await this.httpClientService.get('MENU_SERVICE', `/restaurant/${order.restaurantId}`);
              const emailBody = this.generateDynamicEmailTemplate(order, webConfig, branch, restaurant, user);

              await this.emailService.sendEmail(
                user.email,
                emailSubject,
                emailBody,
              );
            } catch (emailError) {
              console.error(`Email sending failed for order ${order.orderId}:`, emailError.message);
            }
          })();
        }

        console.log('order.pointsToBeRedeemed', order.pointsToBeRedeemed);
        console.log('user?.userType', user?.userType);

        if ((order.pointsToBeRedeemed > 0) && (user?.userType == UserTypeEnum.CUSTOMER)) {
          console.log('🔄 Starting reward point redemption process');
          console.log('🧾 Order Info:', {
            orderId: order.orderId,
            userId: order.userId,
            restaurantId: order.restaurantId,
            pointsToBeRedeemed: order.pointsToBeRedeemed,
            userType: user.userType,
          });
          try {
            const rewardUpdateResult = await this.dbServices.reward.findOneAndUpdate(
              { userId: order.userId, restaurantId: order.restaurantId },
              { $inc: { rewardPoints: -order.pointsToBeRedeemed } },
              { upsert: true, new: true },
            );

            if (!rewardUpdateResult) {
              console.error('⚠️ No reward document matched or created during upsert!');
            } else {
              console.log('✅ Reward points updated successfully:', rewardUpdateResult.rewardPoints);
            }

            const rewardLog: IRewardTransactionLog = {
              userId: order.userId,
              adjustType: RewardAdjustmentTypes.SUBTRACT,
              quantity: order.pointsToBeRedeemed,
              reason: 'rewards redeemed for the order',
              adjustedBy: 'admin',
              restaurantId: order.restaurantId,
              orderId: order.orderId,
            };
            const logResult = await this.dbServices.rewardTransactionLog.create(rewardLog);
            console.log('📝 Reward transaction log created:', logResult._id);
          } catch (error) {
            console.error('Error redeeming rewards:', error.message);
          }
        }
      } else if (paymentStatus === PaymentStatusEnum.PAYMENT_FAILED) {
        order.orderStatus = OrderStatus.PENDING;
      } else if (paymentStatus === PaymentStatusEnum.REFUND_PROCESSED) {
        order.orderStatus = OrderStatus.CANCELLED;
        if (paymentInfo.fullyRefund) {
          await this.dbServices.reward.findOneAndUpdate(
            { userId: order.userId, restaurantId: order.restaurantId },
            { $inc: { rewardPoints: -order.totalPointsToBeAdded } },
            { upsert: true, new: true },
          );
          const rewardLog: IRewardTransactionLog = {
            userId: order.userId,
            adjustType: RewardAdjustmentTypes.SUBTRACT,
            quantity: order.totalPointsToBeAdded,
            reason: 'rewards deducted for the refunded order',
            adjustedBy: 'admin',
            restaurantId: order.restaurantId,
            orderId: order.orderId,
          };
          await this.dbServices.rewardTransactionLog.create(rewardLog);
        }
      } else if (paymentStatus === PaymentStatusEnum.PARTIALLY_REFUNDED) {
        const pointsToDeduct = paymentInfo.pointsToDeduct || 0;

        await this.dbServices.reward.findOneAndUpdate(
          { userId: order.userId, restaurantId: order.restaurantId },
          { $inc: { rewardPoints: -pointsToDeduct } },
          { upsert: true, new: true },
        );

        const rewardLog: IRewardTransactionLog = {
          userId: order.userId,
          adjustType: RewardAdjustmentTypes.SUBTRACT,
          quantity: pointsToDeduct,
          reason: 'rewards deducted for partially refunded order',
          adjustedBy: 'admin',
          restaurantId: order.restaurantId,
          orderId: order.orderId,
        };
        await this.dbServices.rewardTransactionLog.create(rewardLog);
      }

      const updatedOrder = await this.dbServices.order.findOneAndUpdate(
        { orderId: order.orderId },
        order,
        { new: true }
      );
      await this.dbServices.cart.findOneAndDelete({ userId: order.userId });

      return updatedOrder;
    } catch (error) {
      throw new BadRequestException(`Failed to update payment status: ${error.message}`);
    }
  }

  /**
   * Generates a dynamic HTML email template based on order data
   * @param {Object} order - The order object containing all order details
   * @returns {string} - The complete HTML email with order data injected
   */
  private generateDynamicEmailTemplate(order, webConfig, branch, restaurant, user) {

    // Get non-admin URL from restaurant origin URLs
    const getCustomerUrl = (originUrls: string[] = []) => {
      // Find the URL that doesn't contain 'admin'
      const customerUrl = originUrls.find(url =>
        url && !url.toLowerCase().includes('admin') && url.startsWith('https://'));

      return customerUrl || '#'; // Return '#' if no valid URL found
    };

    const restaurantUrl = getCustomerUrl(restaurant?.restaurantOriginUrl);

    const formattedDate = new Date(order?.orderDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedTime = order.orderTime && order.orderTime.from !== order.orderTime.to
      ? `${order.orderTime.from} - ${order.orderTime.to}`
      : "ASAP";

    const formattedDateTime = `${formattedDate}, ${formattedTime}`;

    const toTitleCase = (str = '') =>
      str.replace(/([A-Z])/g, ' $1')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();

    const orderType = toTitleCase(order.orderType);
    const orderStatusDisplay = toTitleCase(order.orderStatus);
    const deliveryFee = order.deliveryFee > 0 ? `${order.deliveryFee.toFixed(2)}` : '';
    const isDiscountAmount = order.couponDiscountAmount > 0 ? `${order.couponDiscountAmount.toFixed(2)}` : '';

    const deliveryMessage = order.orderType.toLowerCase() === 'delivery'
      ? "Your order is on its way! We'll make sure everything is prepared with care and delivered fresh to your doorstep."
      : "Your order will be ready for pickup soon! We'll make sure everything is prepared with care and ready for you.";

    // Build order summary rows dynamically based on available fields

    const itemsHTML = order.items.map(item => {
      const modifiersText = item.modifierGroups?.map(group => {
        const options = group.options.map(option => option.optionName).join(', ');
        return `${group.modifierGroupName}: ${options}.`;
      }).join(' ') || '';

      return `
    <div style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
      <p style="font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 500; margin: 0 0 4px 0;">
        ${item.productName.trim()} × ${item.quantity.toString().padStart(2, '0')}
      </p>
      <p style="font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; color: ${webConfig.theme.primaryColor}; margin: 0 0 4px 0;">
        ₹${item.price.toFixed(2)}
      </p>
      <p style="font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; color: #666666; margin: 0;">
        ${item.description || ''} ${modifiersText}
      </p>
    </div>
  `;
    }).join('');

    // Build order summary rows dynamically based on available fields
    let orderSummaryRows = `<tr><td>Subtotal</td><td align="right">₹${order.subtotal.toFixed(2)}</td></tr>`;


    // Combine taxes and platform fee into "Tax Fee" if either is present
    const totalTaxFee = (order.taxes || 0) + (order.platformFee && order.platformFee > 0 ? order.platformFee : 0);

    if (totalTaxFee > 0) {
      orderSummaryRows += `<tr><td>Taxes & Fees</td><td align="right">₹${totalTaxFee.toFixed(2)}</td></tr>`;
    }

    // // Add taxes if present
    // if (order.taxes !== undefined && order.taxes !== null) {
    //   orderSummaryRows += `<tr><td>Taxes</td><td align="right">₹${order.taxes.toFixed(2)}</td></tr>`;
    // }

    // // Add platform fee if present
    // if (order.platformFee !== undefined && order.platformFee !== null && order.platformFee > 0) {
    //   orderSummaryRows += `<tr><td>Platform Fee</td><td align="right">₹${order.platformFee.toFixed(2)}</td></tr>`;
    // }

    // Add delivery tip if present and greater than 0
    if (order.deliveryTipAmount !== undefined && order.deliveryTipAmount !== null && order.deliveryTipAmount > 0) {
      orderSummaryRows += `<tr><td>Tip</td><td align="right">₹${order.deliveryTipAmount.toFixed(2)}</td></tr>`;
    }

    if (isDiscountAmount) {
      orderSummaryRows += `<tr><td>Discount</td><td align="right">₹${isDiscountAmount}</td></tr>`;
    }

    if (deliveryFee) {
      orderSummaryRows += `<tr><td>Delivery Fee</td><td align="right">₹${deliveryFee}</td></tr>`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>Email Template</title>
  <style>
    @media only screen and (max-width: 600px) {
      .full-width-mobile {
        width: 100% !important;
        display: block;
      }
      .order-details td {
        display: block;
        width: 100% !important;
        padding: 5px 0;
        box-sizing: border-box;
      }
      .order-details td:first-child {
        font-weight: bold;
        text-align: left !important;
      }
      .order-details td:last-child {
        text-align: left !important;
        margin-bottom: 10px;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 10px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" class="full-width-mobile" style="background-color: #ffffff; border-radius: 10px;">
          <!-- Header -->
          <tr>
            <td style="padding: 20px;">
              <table width="100%">
                <tr>
                  <td style="width: 80px;">
                    <div>
                    <img src="${webConfig.theme?.logoUrl}" alt="Logo" style="width:80px; height:80px;border-radius:6px;object-fit:cover;" />
                    </div>
                  </td>
                  <td align="right">
                    <a href="${restaurantUrl}/profile" style="background-color: ${webConfig.theme.primaryColor}; color: white; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-size: 14px;">My Rewards</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Thank You -->
          <tr>
            <td align="center" style="background-color: ${webConfig.theme.primaryColor}; color: #ffffff; padding: 20px; border-radius: 10px;">
              <h1 style="margin: 0; font-size: 24px;">Thank You for Your Order 🎉!</h1>
              <p style="margin: 5px 0 0 0; font-size: 16px;">Order has been confirmed</p>
            </td>
          </tr>
          <!-- Message -->
          <tr>
            <td align="center" style="padding: 20px;">
              <p style="font-size: 18px; margin: 0;">Hi ${user.firstName},</p>
              <p style="font-size: 16px; margin: 10px 0 0 0;">${deliveryMessage}</p>
            </td>
          </tr>
          <!-- Order Details -->
          <tr>
            <td style="padding: 20px;">
              <h2 style="text-align: center; font-size: 18px; margin-top: 0;">Order Details</h2>
              <table width="100%" cellpadding="5" class="order-details" style="table-layout: fixed;">
                <tr>
                  <td style="width: 50%; word-wrap: break-word;">Order Number:</td>
                  <td style="width: 50%; word-wrap: break-word; text-align: right;">#${order.orderId}</td>
                </tr>
                <tr>
                  <td style="width: 50%; word-wrap: break-word;">Order Type:</td>
                  <td style="width: 50%; word-wrap: break-word; text-align: right;">${orderType}</td>
                </tr>
                <tr>
                  <td style="width: 50%; word-wrap: break-word;">Order Status:</td>
                  <td style="width: 50%; word-wrap: break-word; text-align: right;">${orderStatusDisplay}</td>
                </tr>
                <tr>
                  <td style="width: 50%; word-wrap: break-word;">Order Date & Time:</td>
                  <td style="width: 50%; word-wrap: break-word; text-align: right;">${formattedDateTime}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Items Ordered -->
          <tr>
            <td style="padding: 20px;">
              <h2 style="text-align: center; font-size: 18px; margin-top: 0;">Items Ordered</h2>
              ${itemsHTML}
            </td>
          </tr>
          <!-- Order Summary -->
          <tr>
            <td style="padding: 20px;">
              <h2 style="text-align: center; font-size: 18px; margin-top: 0;">Order Summary</h2>
              <table width="100%" cellpadding="5" style="table-layout: fixed;">
                ${orderSummaryRows}
                <tr><td colspan="2"><hr style="border-top: 1px solid #e5e5e5;"></td></tr>
                <tr>
                  <td style="width: 50%; word-wrap: break-word;"><strong>Total</strong></td>
                  <td style="width: 50%; word-wrap: break-word; text-align: right;"><strong style="color:${webConfig.theme.primaryColor};">₹${order.total.toFixed(2)}</strong></td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Help Section -->
          <tr>
            <td style="padding: 20px; text-align: center;">
              <h2 style="font-size: 18px; margin-top: 0;">Need Some Help?</h2>
              <p style="font-size: 16px; margin: 0;">For questions about your order <strong>#${order.orderId}</strong>, call 
              <strong>${restaurant.restaurantName}
              </strong> at <span style="color: ${webConfig.theme.primaryColor}; font-weight: bold;">${branch.phone}</span></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:${webConfig.theme.primaryColor}; color: white; text-align: center; padding: 20px; border-top-left-radius: 10px; border-top-right-radius: 10px;">
              <p style="margin: 0; font-size: 14px;">Thank you for choosing us!</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  }


  private getGrowthIndicator(growthPercentage: number): {
    trend: 'increase' | 'decrease' | 'no_change';
    percentage: number;
  } {
    return {
      trend: growthPercentage > 0 ? 'increase' : growthPercentage < 0 ? 'decrease' : 'no_change',
      percentage: Math.abs(growthPercentage)
    };
  }

  async getOrderStats(restaurantId: string, queryDto: OrderStatsQueryDto): Promise<OrderStatsWithComparison> {
    try {
      let fromDate: Date, toDate: Date;

      let branch;
      try {
        branch = await this.httpClientService.get('MENU_SERVICE', `/branch/${queryDto.branchId}`);
      } catch (error) {
        console.warn(`Failed to fetch branch details: ${error.message}`);
      }

      let branchTimezone = branch?.timezone;

      if (queryDto.fromDate && queryDto.toDate) {
        // If dates are provided, use them
        toDate = momentTz.tz(queryDto.toDate, branchTimezone).endOf('day').clone().utc().toDate(); // includes full end date
        fromDate = momentTz.tz(queryDto.fromDate, branchTimezone).startOf('day').clone().utc().toDate(); // includes full start date
      } else {
        // Default to current month vs previous month
        const now = momentTz.tz(branchTimezone);
        toDate = now.endOf('month').clone().utc().toDate();
        fromDate = now.startOf('month').clone().utc().toDate();
      }

      // Validate date range (max 90 days)
      const maxAllowedDate = new Date(toDate);
      maxAllowedDate.setDate(maxAllowedDate.getDate() - 90);
      if (fromDate < maxAllowedDate) {
        throw new BadRequestException('Date range cannot exceed 90 days');
      }

      // Calculate period difference in days
      const periodDays = Math.ceil(
        (momentTz(toDate, branchTimezone).endOf('day').diff(momentTz(fromDate, branchTimezone).startOf('day'), 'days', true))
      );

      // If period is exactly 90 days, return with 100% increase
      if (periodDays === 90) {
        const currentStats = await this.getStatsForPeriod(restaurantId, fromDate, toDate, queryDto.branchId);
        return {
          ...currentStats,
          comparison: {
            previousPeriodSales: 0,
            sales: { trend: 'increase', percentage: 100 },
            previousPeriodOrders: 0,
            orders: { trend: 'increase', percentage: 100 },
            previousPeriodAverage: 0,
            average: { trend: 'increase', percentage: 100 }
          }
        };
      }

      let previousPeriodStartDate: Date;
      let previousPeriodEndDate: Date;

      if (periodDays <= 45) {
        // Compare same number of days before fromDate
        previousPeriodEndDate = momentTz(fromDate, branchTimezone).subtract(1, 'day').endOf('day').clone().utc().toDate();
        previousPeriodStartDate = momentTz(previousPeriodEndDate, branchTimezone)
          .subtract(periodDays - 1, 'days')
          .startOf('day')
          .toDate();
      } else {
        // Compare remaining days to make up 90 days
        const comparisonDays = 90 - periodDays;
        previousPeriodEndDate = momentTz(fromDate, branchTimezone).subtract(1, 'day').endOf('day').clone().utc().toDate();
        previousPeriodStartDate = momentTz(previousPeriodEndDate, branchTimezone)
          .subtract(comparisonDays - 1, 'days')
          .startOf('day')
          .toDate();
      }

      // Get stats for both periods
      const [currentStats, previousStats] = await Promise.all([
        this.getStatsForPeriod(restaurantId, fromDate, toDate, queryDto.branchId),
        this.getStatsForPeriod(restaurantId, previousPeriodStartDate, previousPeriodEndDate, queryDto.branchId)
      ]);

      // Calculate growth percentages
      const calculateGrowth = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const salesGrowth = calculateGrowth(currentStats?.totalSales || 0, previousStats?.totalSales || 0);
      const ordersGrowth = calculateGrowth(currentStats?.totalOrders || 0, previousStats?.totalOrders || 0);
      const averageGrowth = calculateGrowth(currentStats?.averageOrderValue || 0, previousStats?.averageOrderValue || 0);

      return {
        ...currentStats,
        comparison: {
          previousPeriodSales: previousStats?.totalSales || 0,
          sales: this.getGrowthIndicator(salesGrowth),
          previousPeriodOrders: previousStats?.totalOrders || 0,
          orders: this.getGrowthIndicator(ordersGrowth),
          previousPeriodAverage: previousStats?.averageOrderValue || 0,
          average: this.getGrowthIndicator(averageGrowth)
        }
      };

    } catch (error) {
      throw new BadRequestException('Failed to fetch order statistics: ' + error.message);
    }
  }

  private async getStatsForPeriod(
    restaurantId: string,
    fromDate: Date,
    toDate: Date,
    branchId?: string
  ): Promise<OrderStats> {
    const matchStage: any = {
      restaurantId,
      orderDate: {
        $gte: fromDate,
        $lte: toDate
      },
      orderStatus: { $eq: OrderStatus.ORDER_COMPLETED }
    };

    if (branchId) {
      matchStage.branchId = branchId;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$total' }
        }
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          totalSales: { $round: ['$totalSales', 2] },
          averageOrderValue: {
            $round: [
              {
                $cond: [
                  { $eq: ['$totalOrders', 0] },
                  0,
                  { $divide: ['$totalSales', '$totalOrders'] }
                ]
              },
              2
            ]
          }
        }
      }
    ];

    const results = await this.dbServices.order.aggregate(pipeline);

    return results[0] as OrderStats;
  }

  async acceptBranchOrders(branchId: string): Promise<{ accepted: number }> {
    try {
      // Verify branch exists
      const branch = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);
      if (!branch) {
        throw new NotFoundException(`Branch with ID ${branchId} not found`);
      }
      // Update all pending orders for this branch
      const result = await this.dbServices.order.updateMany(
        {
          branchId: branchId,
          orderStatus: OrderStatus.PLACED
        },
        {
          $set: { orderStatus: OrderStatus.ACCEPTED }
        }
      );

      return {
        accepted: result.modifiedCount
      };
    } catch (error) {
      throw new BadRequestException(`Failed to accept branch orders: ${error.message}`);
    }
  }

  async sendEmail(orderId: string) {
    const order = await this.dbServices.order.findOne({ orderId });
    const emailSubject = `Order Confirmation - #${orderId}`;
    const webConfig = await this.httpClientService.get('MENU_SERVICE', `/website-config`);
    const branch = await this.httpClientService.get('MENU_SERVICE', `/branch/${order?.branchId}`);
    const restaurant = await this.httpClientService.get('MENU_SERVICE', `/restaurant/${order?.restaurantId}`)
    const user = await this.dbServices.user.findOne({ userId: order?.userId });
    const emailBody = this.generateDynamicEmailTemplate(order, webConfig, branch, restaurant, user);

    await this.emailService.sendToBranch(emailSubject, emailBody, order?.branchId);
  }

  async getDailySalesStats(
    restaurantId: string,
    timezone: string,
    fromDate?: string,
    toDate?: string,
    branchId?: string
  ): Promise<DailySales[]> {
    try {
      let branch;
      try {
        branch = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`);
      } catch (error) {
        console.warn(`Failed to fetch branch details: ${error.message}`);
      }

      let branchTimezone = branch?.timezone;
      // Calculate date range
      const endDate = toDate ? momentTz.tz(toDate, branchTimezone).endOf('day').toDate() : new Date();
      const startDate = fromDate
        ? momentTz.tz(fromDate, branchTimezone).startOf('day').toDate()
        : new Date(endDate.getTime() - (90 * 24 * 60 * 60 * 1000));

      // Get all orders within date range
      const orders = await this.dbServices.order.find({
        restaurantId,
        branchId,
        orderDate: {
          $gte: startDate,
          $lte: endDate
        },
        orderStatus: OrderStatus.ORDER_COMPLETED,
        isDeleted: { $in: [null, false] }
      });

      // Initialize data structure for daily sales
      const dailySalesMap = new Map<string, DailySales>();
      let currentDate = momentTz.tz(fromDate || momentTz(startDate).format('YYYY-MM-DD'), branchTimezone).startOf('day');
      const endMoment = momentTz.tz(toDate || momentTz(endDate).format('YYYY-MM-DD'), branchTimezone).startOf('day');

      // Initialize all dates with zero values (inclusive of end date)
      while (currentDate.isSameOrBefore(endMoment, 'day')) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        dailySalesMap.set(dateStr, {
          date: dateStr,
          totalSales: 0,
          orderCount: 0
        });
        currentDate = currentDate.add(1, 'day');
      }

      // Aggregate orders by date
      orders.forEach(order => {
        const orderDate = momentTz(order.orderDate).tz(branchTimezone).format('YYYY-MM-DD');
        const dailyData = dailySalesMap.get(orderDate);
        if (dailyData) {
          dailyData.totalSales = Number((dailyData.totalSales + (order.total || 0)).toFixed(2));
          dailyData.orderCount += 1;
        }
      });

      // Convert map to array and sort by date
      return Array.from(dailySalesMap.values())
        .sort((a, b) => a.date.localeCompare(b.date));

    } catch (error) {
      throw new BadRequestException('Failed to fetch daily sales statistics: ' + error.message);
    }
  }

  async generateOrdersCSV(
    restaurantId: string,
    fromDate?: string,
    toDate?: string,
    branchId?: string,
    orderStatus?: string
  ): Promise<string> {
    try {
      // Calculate date range
      const endDate = toDate
        ? momentTz(toDate).endOf('day').toDate()
        : momentTz().endOf('day').toDate();

      const startDate = fromDate
        ? momentTz(fromDate).startOf('day').toDate()
        : momentTz(endDate).subtract(90, 'days').startOf('day').toDate();
      // 90 days back

      // Build match query
      const matchQuery: any = {
        restaurantId,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
        isDeleted: { $in: [null, false] },
      };

      if (branchId) {
        matchQuery.branchId = branchId;
      }

      // Add orderStatus filter if provided
      if (orderStatus) {
        const orderStatusArray = orderStatus.split(',');
        matchQuery.orderStatus = { $in: orderStatusArray };
      }

      // Fetch orders
      let orders = await this.dbServices.order.find(matchQuery);

      let branchMap = new Map();

      if (branchId) {
        //Fetch only one branch if branchId is provided..
        const branch = await this.httpClientService.get('MENU_SERVICE', `/branch/${branchId}`)
        branchMap.set(branchId, branch);
      } else {
        // Fetch branch details in bulk only when branchId is not provided.
        const branchIds = [...new Set(orders.map((order) => order.branchId))];

        const branchesPromises: any = branchIds.map((id) =>
          this.httpClientService.get('MENU_SERVICE', `/branch/${id}`)
        );
        const branches = await Promise.all(branchesPromises);
        branchMap = new Map(branches.map((branch) => [branch.branchId, branch]));
      }
      // Extract payment IDs from orders
      const paymentIds = orders
        .filter(order => order.paymentId)
        .map(order => order.paymentId);

      if (paymentIds.length > 0) {
        // Fetch all payment details in a single API call
        const payments: IPayment[] = await this.httpClientService.get(
          'PAYMENT_SERVICE',
          `/payments/by-ids?ids=${JSON.stringify(paymentIds)}`
        ) as unknown as IPayment[];

        // Create a map of payment details for quick lookup
        const paymentMap = new Map(
          payments.map(payment => [payment.paymentId, payment])
        );

        // Map payment details to orders
        orders = orders.map(order => {
          const paymentDetail = paymentMap.get(order.paymentId || '');
          if (paymentDetail) {
            order.paymentInfo = {
              paymentStatus: paymentDetail.status,
              totalRefundAmount: paymentDetail.totalRefundAmount || 0,
              payout: paymentDetail.payout || 0,
              processingFee: paymentDetail.processingFee || 0
            };
          }
          return order;
        });
      }

      // Transform orders for CSV
      const exportData: OrderExportData[] = orders.map((order) => {
        // Get branch timezone for this order
        const branch = branchMap.get(order.branchId);
        const timezone = branch?.timezone || 'UTC';

        return {
          orderId: order.orderId,
          orderDate: momentTz(order.createdAt).tz(timezone).format('YYYY-MM-DD HH:mm:ss'),
          customerName: order?.customerInfo?.name || 'Guest',
          orderType: order.orderType,
          orderStatus: order.orderStatus,
          items: order.items
            .map((item) => `${item.productName}(${item.quantity})`)
            .join(', '),
          subtotal: order.subtotal || 0,
          tips: order.deliveryTipAmount || 0,
          taxes: order.taxes || 0,
          total: order.total || 0,
          branchName: branchMap.get(order.branchId)?.name || 'Unknown Branch',
          paymentId: order.paymentId || 'N/A',
          commission: -(order.platformFee || 0),
          processingFee: -(order.paymentInfo?.processingFee || 0),
          payout: order.paymentInfo?.payout || 0,
          adjustments: -(order.paymentInfo?.totalRefundAmount || 0),
          deliveryFee: order.deliveryFee || 0,
          couponDiscountAmount: -(order.couponDiscountAmount || 0),
        };
      });

      // Define CSV fields (same as before)
      const fields = [
        { label: 'Order ID', value: 'orderId' },
        { label: 'Order Date', value: 'orderDate' },
        { label: 'Customer Name', value: 'customerName' },
        { label: 'Order Type', value: 'orderType' },
        { label: 'Order Status', value: 'orderStatus' },
        { label: 'Items', value: 'items' },
        { label: 'Subtotal', value: 'subtotal' },
        { label: 'Tips', value: 'tips' },
        { label: 'Taxes', value: 'taxes' },
        { label: 'Delivery Fee', value: 'deliveryFee' },
        { label: 'Discount Amount', value: 'couponDiscountAmount' },
        { label: 'Total', value: 'total' },
        { label: 'Payment ID', value: 'paymentId' },
        { label: 'Branch Name', value: 'branchName' },
        { label: 'Commission', value: 'commission' },
        { label: 'Processing Fee', value: 'processingFee' },
        { label: 'Payout', value: 'payout' },
        { label: 'Adjustments', value: 'adjustments' },
      ];

      // Generate CSV content (same as before)
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(exportData);
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csv;

      // Create uploads directory if it doesn't exist (same as before)
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      // Generate unique filename (same as before)
      const fileName = `orders_${momentTz().format('YYYY-MM-DD_HH-mm')}.csv`;
      const filePath = path.join(uploadsDir, fileName);

      // Write CSV to file (same as before)
      fs.writeFileSync(filePath, csvWithBOM);

      return filePath;
    } catch (error) {
      throw new BadRequestException(`Failed to generate CSV: ${error.message}`);
    }
  }

  async getUserOrders(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean,
  ): Promise<IPaginatedResult<IOrder[]>> {
    const orders = await this.paginationService.findAndPaginate(
      this.dbServices.order,
      {
        skip,
        limit,
        filter,
        nonPaginated,
      },
    );

    if (!nonPaginated && orders.items.length > 0) {
      // Extract payment IDs from orders
      const paymentIds = orders.items
        .filter((order) => order.paymentId)
        .map((order) => order.paymentId);

      if (paymentIds.length > 0) {
        // Fetch all payment details in a single API call
        const payments: IPayment[] = (await this.httpClientService.get(
          'PAYMENT_SERVICE',
          `/payments/by-ids?ids=${JSON.stringify(paymentIds)}`,
        )) as unknown as IPayment[];

        // Create a map of payment details for quick lookup
        const paymentMap = new Map(
          payments.map((payment) => [payment.paymentId, payment]),
        );

        // Map payment details to orders
        orders.items = orders.items.map((order) => {
          const paymentDetail = paymentMap.get(order.paymentId);
          if (paymentDetail) {
            order.paymentInfo = {
              paymentStatus: paymentDetail.status,
              totalRefundAmount: paymentDetail.totalRefundAmount
                ? paymentDetail.totalRefundAmount
                : 0,
              payout: paymentDetail.payout ? paymentDetail.payout : 0,
              processingFee: paymentDetail.processingFee
                ? paymentDetail.processingFee
                : 0,
            };
          }
          return order;
        });
      }
    }
    return orders;
  }

  private filterOrdersBySearch(orders: any[], searchFilter: { term: string, fields: string[] }): any[] {
    if (!searchFilter || !searchFilter.term || !searchFilter.fields || searchFilter.fields.length === 0) {
      return orders;
    }

    const searchTerm = searchFilter.term.toLowerCase();
    return orders.filter(order => {
      return searchFilter.fields.some(field => {
        // Handle nested fields like customerInfo.name
        const fieldParts = field.split('.');
        let value = order;

        for (const part of fieldParts) {
          if (value === undefined || value === null) {
            return false;
          }
          value = value[part];
        }

        // Convert value to string and check if it includes the search term
        return value !== undefined &&
          value !== null &&
          String(value).toLowerCase().includes(searchTerm);
      });
    });
  }

  async getTodayOrders(
    skip: number,
    limit: number,
    filter: Record<string, any>,
    nonPaginated: boolean = true,
    page: string
  ) {
    try {
      const branchDetails = await this.httpClientService.get('MENU_SERVICE', `/branch/${filter.branchId}`) as any;
      const branchTimezone = branchDetails?.timezone;
      const currentTime = momentTz().tz(branchTimezone);
      const todayStart = currentTime.clone().startOf('day').utc().toDate();

      // Extract search filter before removing restaurantId
      const searchFilter = filter.search;
      delete filter.restaurantId;
      delete filter.search; // Remove search from filter as we'll handle it separately

      let orders: any;

      if (page === OrderPageEnum.SCHEDULED) {
        // For scheduled orders, we want orders from today and future dates
        filter.orderDate = { $gte: todayStart };
        filter.orderStatus = { $in: [OrderStatus.PLACED, OrderStatus.ACCEPTED] };

        const allOrders = await this.paginationService.findAndPaginate(this.dbServices.order, {
          skip: 0,
          limit: 0,
          filter,
          nonPaginated: true,
        });

        const prepTime = branchDetails?.preparationTimeInMins || 30;

        const validScheduledOrders = allOrders.items.filter((order: any) => {
          const orderDateLocal = momentTz(order.orderDate).tz(branchTimezone);
          const [hours, minutes] = order.orderTime.from.split(':').map(Number);
          const orderTimeMoment = orderDateLocal.clone().hour(hours).minute(minutes);

          // Calculate cutoff time based on order type
          let cutoffTime;
          if (order.orderType === OrderTypeEnum.DELIVERY) {
            // For delivery orders, add prepTime + 30 minutes for delivery time
            cutoffTime = currentTime.clone().add(prepTime + 30, 'minutes');
          } else {
            // For pickup orders, use only prepTime
            cutoffTime = currentTime.clone().add(prepTime, 'minutes');
          }

          return orderTimeMoment.isAfter(cutoffTime);
        });

        // 1. Get only PLACED orders that are not ASAP
        const nonAsapPlacedOrders = validScheduledOrders.filter((order: any) =>
          order.orderStatus === OrderStatus.PLACED && order.orderTime.from !== order.orderTime.to
        );

        // 2. Get ACCEPTED orders
        const acceptedOrders = validScheduledOrders.filter((order: any) =>
          order.orderStatus === OrderStatus.ACCEPTED
        );

        // 3. Merge both sets
        const mergedOrders = [...nonAsapPlacedOrders, ...acceptedOrders];

        // 4. Apply search filter
        const filteredOrders = this.filterOrdersBySearch(mergedOrders, searchFilter);

        orders = {
          total: filteredOrders.length,
          items: filteredOrders
        };
      }

      if (page === OrderPageEnum.PLACED) {
        filter.orderStatus = OrderStatus.PLACED;

        const allOrders = await this.paginationService.findAndPaginate(this.dbServices.order, {
          skip: 0,
          limit: 0,
          filter,
          nonPaginated: true,
        });

        const prepTime = branchDetails?.preparationTimeInMins || 30;

        // 1. Separate ASAP orders (from === to)
        const asapOrders = allOrders.items.filter((order: any) => {
          return order.orderTime.from === order.orderTime.to;
        });

        // 2. Get time-constrained orders (all - asap)
        const timeConstraintOrders = allOrders.items.filter((order: any) => {
          return order.orderTime.from !== order.orderTime.to;
        });

        // 3. Notify orders whose time is before or at cutoff
        const notifyOrders = timeConstraintOrders.filter((order: any) => {
          const orderDateLocal = momentTz(order.orderDate).tz(branchTimezone);
          const [hours, minutes] = order.orderTime.from.split(':').map(Number);
          const orderTimeMoment = orderDateLocal.clone().hour(hours).minute(minutes);

          // Calculate cutoff time based on order type
          let cutoffTime;
          if (order.orderType === OrderTypeEnum.DELIVERY) {
            // For delivery orders, add prepTime + 30 minutes for delivery time
            cutoffTime = currentTime.clone().add(prepTime + 30, 'minutes');
          } else {
            // For pickup orders, use only prepTime
            cutoffTime = currentTime.clone().add(prepTime, 'minutes');
          }

          return orderTimeMoment.isSameOrBefore(cutoffTime);
        });

        // 4. Apply search filter to notify orders
        const filteredNotifyOrders = this.filterOrdersBySearch(notifyOrders, searchFilter);

        // 5. Combine ASAP and notify orders
        orders = {
          total: asapOrders.length + filteredNotifyOrders.length,
          items: [...asapOrders, ...filteredNotifyOrders],
        };
      }

      if (page === OrderPageEnum.COOKING) {
        filter.orderStatus = { $in: [OrderStatus.ACCEPTED, OrderStatus.PREPARING] };

        const allOrders = await this.paginationService.findAndPaginate(this.dbServices.order, {
          skip: 0,
          limit: 0,
          filter,
          nonPaginated: true,
        });

        let acceptedOrders = [];
        let preparingOrders = [];
        const uniqueOrderIds = new Set();

        const prepTime = branchDetails?.preparationTimeInMins || 30;

        // First, get preparing orders
        preparingOrders = allOrders.items.filter((order: any) => {
          if (order.orderStatus === OrderStatus.PREPARING) {
            uniqueOrderIds.add(order._id.toString());
            return true;
          }
          return false;
        });

        // Then get accepted orders that aren't already in preparing orders
        acceptedOrders = allOrders.items.filter((order: any) => {
          if (uniqueOrderIds.has(order._id.toString())) {
            return false;
          }

          // Convert order date to branch timezone
          const orderDateLocal = momentTz(order.orderDate).tz(branchTimezone);

          // Convert order time to moment object in branch timezone
          const [hours, minutes] = order.orderTime.from.split(':').map(Number);
          const orderTimeMoment = orderDateLocal.clone().hour(hours).minute(minutes);

          // Calculate cutoff time based on order type
          let cutoffTime;
          if (order.orderType === OrderTypeEnum.DELIVERY) {
            // For delivery orders, add prepTime + 30 minutes for delivery time
            cutoffTime = currentTime.clone().add(prepTime + 30, 'minutes');
          } else {
            // For pickup orders, use only prepTime
            cutoffTime = currentTime.clone().add(prepTime, 'minutes');
          }

          return orderTimeMoment.isBefore(cutoffTime) || orderTimeMoment.isSame(cutoffTime);
        });

        // Apply search filter
        const filteredAcceptedOrders = this.filterOrdersBySearch(acceptedOrders, searchFilter);
        const filteredPreparingOrders = this.filterOrdersBySearch(preparingOrders, searchFilter);

        orders = {
          total: filteredAcceptedOrders.length + filteredPreparingOrders.length,
          items: [...filteredAcceptedOrders, ...filteredPreparingOrders]
        };
      }

      // Sort all items by createdAt in descending order before pagination
      orders.items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Handle pagination based on nonPaginated parameter
      if (!nonPaginated) {
        const start = skip;
        const end = skip + limit;
        const paginatedItems = orders.items.slice(start, end);

        return {
          totalItems: orders.total,
          totalPages: Math.ceil(orders.total / limit),
          skip,
          limit,
          items: paginatedItems
        };
      }

      // Return non-paginated results
      return {
        totalItems: orders.total,
        totalPages: 1,
        skip: 0,
        limit: orders.total,
        items: orders.items
      };

    } catch (error) {
      throw new BadRequestException('Failed to fetch today orders: ' + error.message);
    }
  }

  /**
   * Handles delivery order creation asynchronously to prevent blocking order status updates
   * @param order - The order object
   * @param branch - The branch object
   */
  private async handleDeliveryOrderCreation(order: IOrder, branch: any): Promise<void> {
    try {
      // Check if delivery order already exists for this order
      const existingDeliveryOrder = await this.dbServices.deliveryOrder.findOne({ orderId: order.orderId });
      if (existingDeliveryOrder) {
        console.log(`📦 Delivery order already exists for order ${order.orderId}, skipping creation`);
        return;
      }

      // Parse branch address to get structured data
      let branchAddressDetails: any = {
        streetAddress: [],
        city: '',
        state: '',
        zipCode: '',
        country: '',
      };
      if (branch?.address) {
        branchAddressDetails = await this.parseAddress(branch.address);
      }

      // Try to get coordinates from address.location first, then fallback to order.location
      let coordinates = order?.address?.location?.coordinates;
      if (!coordinates || coordinates.length < 2) {
        coordinates = order?.location?.coordinates;
      }

      const latitude = coordinates && coordinates.length > 1 ? coordinates[1] : 0;
      const longitude = coordinates && coordinates.length > 0 ? coordinates[0] : 0;

      const createDeliveryDto: CreateDeliveryOrderDto = {
        orderId: order.orderId,
        userId: order.userId,
        restaurantId: order.restaurantId,
        branchId: order.branchId,
        branchName: branch.name || '',
        branchPhone: branch.phone || '',
        orderAmount: order.total || 0,
        deliveryAddress: {
          streetAddress: order.address?.streetAddress
            ? Array.isArray(order.address.streetAddress) && order.address.streetAddress.length > 0
              ? order.address.streetAddress[0]
              : typeof order.address.streetAddress === 'string'
                ? order.address.streetAddress
                : ''
            : '',
          apartment: order.address?.apartment || '',
          city: order.address?.city || '',
          zipCode: order.address?.zipCode || '',
          latitude: latitude,
          longitude: longitude
        },
        pickupAddress: {
          streetAddress: Array.isArray(branchAddressDetails.streetAddress) && branchAddressDetails.streetAddress.length > 0
            ? branchAddressDetails.streetAddress[0]
            : typeof branchAddressDetails.streetAddress === 'string'
              ? branchAddressDetails.streetAddress
              : branch?.address || '',
          apartment: '',
          city: branchAddressDetails.city || '',
          zipCode: branchAddressDetails.zipCode || '',
          latitude: branch?.location?.coordinates?.[1] || 0,
          longitude: branch?.location?.coordinates?.[0] || 0
        },
        deliveryFee: order.deliveryFee,
        items: order.items?.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          price: item.price
        })) || [],
        customerInfo: order.customerInfo
      };

      await this.deliveryService.createDeliveryOrder(createDeliveryDto);
      console.log(`✅ Delivery order created successfully for order ${order.orderId}`);
    } catch (error) {
      console.error(`❌ Failed to create delivery order for order ${order.orderId}:`, error.message);
      // Re-throw the error so it can be caught by the calling method
      throw error;
    }
  }

  private async createCouponLog(userId: string, branchId: string, couponCode: string, couponDiscountAmount: number, expiryDate: string) {
    const existingCouponLog = await this.dbServices.couponlog.findOne({
      userId,
      branchId,
      couponCode
    });

    if (!existingCouponLog) {
      await this.dbServices.couponlog.create({
        couponCode,
        userId,
        branchId,
        couponDiscountAmount,
        expiryDate,
        redeemedStatus: CouponRedeemedStatus.PENDING,
        maxRedemptions: 1
      });
    } else {
      await this.dbServices.couponlog.findOneAndUpdate(
        { couponLogsId: existingCouponLog.couponLogsId },
        { $set: { maxRedemptions: (existingCouponLog.maxRedemptions || 0) + 1 } },
        { new: true }
      );
    }
  }

  /* Cron job to refresh trending orders cache every 1 minutes */
  @Cron('0 */1 * * * *')
  handleCronTrendingOrders() {
    return this.refreshTrendingOrdersCache();
  }

  async refreshTrendingOrdersCache(): Promise<void> {
    const startOfDay = momentTz(new Date(), ASIA_CALCUTTA_TIMEZONE)
      .startOf('day')
      .utc()
      .toDate();

    await this.dbServices.order.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $sort: { restaurantId: 1, total: -1 } },
      {
        $group: {
          _id: '$restaurantId',
          topOrders: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          topOrders: { $slice: ['$topOrders', 10] },
        },
      },
      { $unwind: '$topOrders' },
      { $replaceRoot: { newRoot: '$topOrders' } },
      { $out: 'topOrdersTodayCache' },
    ]);

    console.log(`[${new Date().toISOString()}] Trending orders cache refreshed`);
  }

  async getTrendingOrders(clientId: string) {
    try {
      return await this.mongoViewService.getTrendingOrders(clientId);
    } catch (error: any) {
      throw new BadRequestException('Failed to fetch trending orders: ' + error.message);
    }
  }

  async getTrendingProducts(
    clientId: string,
    skip: number = 0,
    limit: number = 10,
  ): Promise<IPaginatedResult<any>> {
    try {
      const trending = await this.mongoViewService.getTrendingProducts(clientId);
      const totalItems = trending?.length ?? 0;
      if (!trending?.length) {
        return { items: [], totalItems: 0, totalPages: 0 };
      }

      const paginatedTrending = trending.slice(skip, skip + limit);
      const productIds = [...new Set(paginatedTrending.map((t) => t.productId))];
      let productsMap = new Map<string, any>();
      try {
        const raw = await this.httpClientService.post('MENU_SERVICE', '/product/by-product-ids', {
          productIds,
        });
        const products = raw && typeof raw === 'object' && 'result' in raw ? (raw as any).result : raw;
        if (Array.isArray(products)) {
          productsMap = new Map(products.map((p) => [p.productId, p]));
        }
      } catch (err) {
        // Return trending with counts even if product fetch fails
      }

      const items = paginatedTrending.map((item) => {
        const product = productsMap.get(item.productId);
        return product ? { ...item, ...product } : item;
      });

      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      return { items, totalItems, totalPages };
    } catch (error: any) {
      throw new BadRequestException('Failed to fetch trending products: ' + error.message);
    }
  }

}
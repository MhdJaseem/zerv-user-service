import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { ICart } from '../../common/interfaces/cart.interface';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { DELIVERY_FEE, PLATFORM_FEE } from '../../common/constants/common.constants';
import { OrderTypeEnum } from 'src/common/enums/user.enum';
import { Helpers } from 'src/common/helpers/common.helpers';
import { LocationInfo } from '../delivery/interfaces/delivery-order.interface';
import { CouponDiscountType, CouponRedeemedStatus } from 'src/common/enums/cart.enum';
import { ErrorException } from '../../common/errors/custom-error.exception';
import { DeliveryService } from '../delivery/delivery.service';

@Injectable()
export class CartService {
  constructor(private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly httpClientService: HttpClientService,
    private readonly deliveryService: DeliveryService
  ) { }

  async appendCart(userId: string, cartDto: CreateCartDto) {
    try {
      if (cartDto.items.length === 0) {
        throw new BadRequestException('Cart cannot be empty');
      }

      // Check if user already has a cart
      const existingCart = await this.dbServices.cart.findOne({ userId });

      // Check if branch or restaurant has changed - if so, clear the cart
      if (existingCart &&
        (existingCart.branchId !== cartDto.branchId ||
          existingCart.restaurantId !== cartDto.restaurantId ||
          existingCart.orderType !== cartDto.orderType)) {

        // Create a new cart with new branch/restaurant/orderType
        console.log('Branch, restaurant or order type changed. Clearing existing cart.');
        await this.dbServices.cart.findOneAndDelete({ userId });
      }

      // Extract modifierGroupIds and optionIds from the new structure
      const modifierGroupIds: string[] = [];
      const optionIds: string[] = [];

      cartDto.items.forEach(item => {
        item.modifierGroups?.forEach(group => {
          modifierGroupIds.push(group.modifierGroupId);

          // Extract optionIds from the new structure where options are objects
          group.options.forEach(option => {
            if (typeof option === 'object' && option.optionId) {
              optionIds.push(option.optionId);
            }
          });
        });
      });

      // Fetch all required data in parallel
      const [user, products, modifierGroups, options, branch] = await Promise.all([
        this.dbServices.user.findOne({ userId }),
        this.httpClientService.post('MENU_SERVICE', '/product/by-product-ids', {
          productIds: cartDto.items?.map((item) => item.productId)
        }) as unknown as Array<any>,
        this.httpClientService.post('MENU_SERVICE', '/modifier-group/by-ids', {
          modifierGroupIds: modifierGroupIds
        }) as unknown as Array<any>,
        this.httpClientService.post('MENU_SERVICE', '/option/by-ids', {
          modifierOptionIds: optionIds
        }) as unknown as Array<any>,
        this.httpClientService.get('MENU_SERVICE', '/branch/' + cartDto.branchId) as unknown as any
      ]);

      // Validation check
      if (!products) throw new BadRequestException('Products not found');

      // Create lookup maps for faster access
      const productsMap = new Map(products.map(product => [product.productId, product]));
      const modifierGroupsMap = new Map(modifierGroups.map(group => [group.modifierGroupId, group]));
      const modifierOptionsMap = new Map(options.map(option => [option.optionId, option]));

      // Transform items with all details
      const transformedItems = cartDto.items.map(item => {
        const product = productsMap.get(item.productId);
        if (!product) {
          throw new BadRequestException(`Product ${item.productId} not found`);
        }

        // Transform modifier groups
        const transformedModifierGroups =
          item.modifierGroups?.map((group) => {
            const modifierGroup = modifierGroupsMap.get(group.modifierGroupId);
            if (!modifierGroup) {
              throw new BadRequestException(
                `Modifier group ${group.modifierGroupId} not found`,
              );
            }

            return {
              modifierGroupId: group.modifierGroupId,
              modifierGroupName: modifierGroup.modifierGroupName,
              options: group.options.map((option) => {
                // Extract optionId from either string or object format
                const optionId =
                  typeof option === 'object' ? option.optionId : option;
                const optionData = modifierOptionsMap.get(optionId);

                if (!optionData) {
                  throw new BadRequestException(
                    `Modifier option ${optionId} not found`,
                  );
                }

                return {
                  optionId: optionData.optionId,
                  optionName: optionData.optionName,
                  price: optionData.price,
                };
              }),
            };
          }) || [];
        if (product?.pointsToAdd > 0) {
          product.pointsToAdd = Number(product?.pointsToAdd.toFixed(0));
        }
        return {
          productId: product.productId,
          productName: product.productName,
          description: product.description,
          price: product.price,
          pointsToAdd: product.pointsToAdd,
          pointsToRedeem: product.pointsToRedeem,
          imageUrl: product.imageUrl,
          quantity: item.quantity,
          cartItemId: item?.cartItemId,
          modifierGroups: transformedModifierGroups,
          IsAddedFromRewards: item.IsAddedFromRewards,
          specialInstructions: item.specialInstructions,
        };
      });

      // Check rewards and update subtotal calculation
      let subtotal = 0;
      let totalPointsToBeAdded = 0;
      const userRewards = await this.dbServices.reward.findOne({
        userId,
        restaurantId: cartDto.restaurantId,
        isDeleted: false,
      });

      // Track points to be redeemed and remaining available points
      let pointsToBeRedeemed = 0;
      let remainingRewardPoints = userRewards?.rewardPoints || 0;

      // Calculate totals with reward redemption logic
      transformedItems.forEach(item => {
        const totalPointsNeeded = item.pointsToRedeem * item.quantity;
        // Check if item is added from rewards section and user has sufficient points
        if (item.IsAddedFromRewards && userRewards && totalPointsNeeded > 0) {
          if (remainingRewardPoints >= totalPointsNeeded && totalPointsNeeded > 0) {
            // User has enough points to redeem all quantities
            pointsToBeRedeemed += totalPointsNeeded;
            remainingRewardPoints -= totalPointsNeeded;
          } else {
            // Redeem as many items as possible with available points
            const maxQtyRedeemable = Math.floor(
              remainingRewardPoints / item.pointsToRedeem,
            );
            const remainingQty = item.quantity - maxQtyRedeemable;

            // Points for redeemable items
            const pointsForRedeemable = maxQtyRedeemable * item.pointsToRedeem;
            pointsToBeRedeemed += pointsForRedeemable;
            remainingRewardPoints -= pointsForRedeemable;

            // Subtotal for items not covered by points
            subtotal += remainingQty * item.price;
          }
        } else {
          // Regular item - add to subtotal
          subtotal += item.price * item.quantity;
        }

        // Add modifier options prices
        item.modifierGroups?.forEach(group => {
          group.options?.forEach(option => {
            if (option.price) {
              subtotal += option.price * item.quantity;
            }
          });
        });

        // Sum pointsToAdd from all products (multiplied by quantity)
        if (item.pointsToAdd && item.pointsToAdd > 0) {
          totalPointsToBeAdded += item.pointsToAdd * item.quantity;
        }
      });

      //Calaulate the coupon discount
      let couponDiscountAmount = 0;
      let couponDetails;
      let couponError:any = null;

      if (cartDto.couponCode) {
        try {
          const couponLogs: any = await this.dbServices.couponlog.find({
            branchId: cartDto.branchId,
            userId,
            couponCode: cartDto.couponCode,
            redeemedStatus: { $in: [CouponRedeemedStatus.PENDING, CouponRedeemedStatus.REDEEMED] }
          });
      
          couponDetails = await this.dbServices.coupon.findOne({
            couponCode: cartDto.couponCode,
            branchId: cartDto.branchId,
          });

          const couponUsageMap = new Map();
          couponLogs.forEach(log => {
            couponUsageMap.set(log.couponCode, log.maxRedemptions);
          });
      
          const now = new Date();
      
          if (!couponDetails || !couponDetails.isActive) {
            couponError = 'Invalid coupon.'
          } else if (couponDetails.expiryDate && new Date(couponDetails.expiryDate).setHours(23, 59, 59, 999) < now.getTime()) {
            couponError = 'Coupon Expired.'
          } else if (couponDetails.maxRedemptions && couponUsageMap.get(cartDto.couponCode) >= couponDetails.maxRedemptions) {
            couponError = 'Coupon Max Redemptions Reached.'
          } else if (
            couponDetails.minOrderAmount &&
            subtotal < couponDetails.minOrderAmount
          ) {
            const shortfallAmount = couponDetails.minOrderAmount - subtotal;
            couponError = 'Minimum Order Amount Not Met. Please add $' + shortfallAmount.toFixed(2) + ' to redeem this coupon.'
          } else {
            // Calculate discount
            if (couponDetails.discountType === CouponDiscountType.PERCENTAGE) {
              const maxDiscountAmount = couponDetails.maxDiscountAmount;
              couponDiscountAmount = subtotal * (couponDetails.discountValue / 100);
              if (couponDiscountAmount > maxDiscountAmount) {
                couponDiscountAmount = maxDiscountAmount;
              }
            } else if (couponDetails.discountType === CouponDiscountType.FIXED) {
              couponDiscountAmount =
                subtotal == couponDetails.discountValue ? 0 : couponDetails.discountValue;
            } else if (couponDetails.discountType === CouponDiscountType.BOGO) {
              // BOGO: Buy One Get One Free for a specific product (aggregate across lines, base price only)
              if (!couponDetails.targetProductId) {
                couponError = 'BOGO coupon missing target product.';
              } else {
                const matchingItems = transformedItems.filter(
                  (item) => item.productId === couponDetails.targetProductId,
                );

                const totalQuantity = matchingItems.reduce((sum, cartItem) => sum + (cartItem.quantity || 0), 0);
                if (totalQuantity < 2) {
                  couponError = 'Add at least 2 of the eligible product to use this coupon.';
                } else {
                  const freeCount = Math.floor(totalQuantity / 2);
                  // Base price is the product price (modifiers excluded)
                  const basePrice = matchingItems[0]?.price || 0;
                  couponDiscountAmount = freeCount * basePrice;
                }
              }
            }
          }
        } catch (err) {
          console.error('Error in coupon logic:', err);
          couponError = 'An unexpected error occurred while validating the coupon.'
        }
      }

      let taxes = (subtotal - couponDiscountAmount) * (branch?.taxRate / 100 || 0);
      let total = subtotal + taxes + (cartDto?.deliveryTipAmount || 0) + (subtotal > 0 ? PLATFORM_FEE : 0) - couponDiscountAmount;

      // Calculate exact values
      const exactTotal = total;

      subtotal = parseFloat(subtotal.toFixed(2));
      taxes = parseFloat(taxes.toFixed(2));
      total = parseFloat(total.toFixed(2));
      couponDiscountAmount = parseFloat(couponDiscountAmount.toFixed(2));


      // Calculate roundoff
      const roundOff = parseFloat((total - exactTotal).toFixed(2));

      // totalPointsToBeAdded is already calculated above by summing pointsToAdd from all products
      totalPointsToBeAdded = Number(totalPointsToBeAdded.toFixed(0));

      let deliveryFeeFromUber = existingCart?.deliveryFee || 0;
      const existingCoordinates = existingCart?.address?.location?.coordinates;
      const newCoordinates = cartDto?.address?.location?.coordinates;

      const isSameCoordinates =
        Array.isArray(existingCoordinates) &&
        Array.isArray(newCoordinates) &&
        existingCoordinates.length === newCoordinates.length &&
        existingCoordinates.every((val, index) => val === newCoordinates[index]);

      if (cartDto.orderType === OrderTypeEnum.DELIVERY && branch?.isDeliveryFree) {
        deliveryFeeFromUber = 0;
      }

      if (cartDto.orderType === OrderTypeEnum.DELIVERY && !isSameCoordinates && !branch?.isDeliveryFree) {
        const pickupLocation: LocationInfo = {
          address: Helpers.parseAddress(branch.address),
          coordinates: {
            latitude: branch.location.coordinates[1],  // Convert from [lng, lat] to {lat, lng}.
            longitude: branch.location.coordinates[0]
          }
        };
        if (!cartDto?.address?.streetAddress) {
          throw new BadRequestException('Address is required for a delivery order');
        }
        const formattedAddress = Helpers.parseAddress(cartDto?.address?.streetAddress);
        const dropOffLocation: LocationInfo = {
          address: {
            ...formattedAddress,
            apartment: cartDto?.address?.apartment // Preserve the apartment number
          },
          coordinates: {
            latitude: cartDto?.address?.location?.coordinates[1], // Convert from [lng, lat] to {lat, lng}
            longitude: cartDto?.address?.location?.coordinates[0]
          }
        };

        deliveryFeeFromUber = await this.deliveryService.getDeliveryFee(
          pickupLocation,
          dropOffLocation,
          branch.branchId
        );
      }
      // Calculate delivery fee with 18% GST
      let deliveryFeeWithGST = 0;
      if (cartDto.orderType === OrderTypeEnum.DELIVERY && deliveryFeeFromUber > 0) {
        deliveryFeeWithGST = parseFloat((deliveryFeeFromUber * 1.18).toFixed(2));
      }

      // Construct final cart object.
      const finalCart: any = {
        userId,
        branchId: cartDto.branchId,
        orderType: cartDto.orderType,
        orderDate: cartDto.orderDate,
        orderTime: cartDto.orderTime,
        items: transformedItems,
        subtotal,
        taxes,
        total,
        roundOff,
        platformFee: subtotal > 0 ? PLATFORM_FEE : 0,
        deliveryFee: deliveryFeeWithGST,
        restaurantId: cartDto.restaurantId,
        address: cartDto.address,
        deliveryTipAmount: cartDto.deliveryTipAmount || 0,
        pointsToBeRedeemed: pointsToBeRedeemed,
        totalPointsToBeAdded: totalPointsToBeAdded,
        getPromotionalEmails: user?.getPromotionalEmails,
        getPromotionalTexts: user?.getPromotionalTexts,
        couponCode: couponDetails?.couponCode ? cartDto.couponCode : null,
        couponDiscountAmount: couponDiscountAmount,
        couponExpiryDate: couponDetails?.expiryDate || ''
      };

      let savedCart;
      if (existingCart &&
        existingCart.branchId === cartDto.branchId &&
        existingCart.restaurantId === cartDto.restaurantId &&
        existingCart.orderType === cartDto.orderType) {
        // Update existing cart if branch/restaurant/orderType hasn't changed
        savedCart = await this.dbServices.cart.findOneAndUpdate(
          { userId },
          { $set: finalCart },
          { new: true }
        );
      } else {
        // Create new cart
        savedCart = await this.dbServices.cart.create(finalCart);
      }

      // Return cart with error information if coupon error
      if (couponError) {
        return {
          ...savedCart,
          couponError: couponError
        };
      }

      return savedCart;
    } catch (err) {
      console.error('Error in appendCart:', err);
      throw err;
    }
  }

  async findAllCart(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<ICart[]>> {
    const orders = await this.paginationService.findAndPaginate(
      this.dbServices.order,
      {
        skip,
        limit,
        filter,
      }
    );
    return orders;
  }

  async findById(cartId: string): Promise<ICart> {
    const cart = await this.dbServices.cart.findOne({ cartId });
    if (!cart) {
      throw new NotFoundException(`Cart with ID ${cartId} not found`);
    }
    return cart;
  }

  async findByUserId(userId: string): Promise<ICart> {
    const cart = await this.dbServices.cart.findOne({ userId });
    const order = await this.dbServices.order.findOne({ userId });

    // Merge the cart and order objects using the spread operator, 
    // and map the promotional fields from the order to the cart
    return {
      ...cart,
      getPromotionalEmails: order?.getPromotionalEmails,
      getPromotionalTexts: order?.getPromotionalTexts,
    };
  }


  async update(cartId: string, updateCartDto: UpdateCartDto): Promise<ICart> {
    const cart = await this.dbServices.cart.findOneAndUpdate(
      { cartId },
      updateCartDto,
      { new: true }
    );
    if (!cart) {
      throw new NotFoundException(`Cart with ID ${cartId} not found`);
    }
    return cart;
  }

  async deleteCart(userId: string): Promise<void> {
    const result = await this.dbServices.cart.findOneAndDelete({ userId });
    if (!result) {
      throw new NotFoundException(`Cart with ID ${userId} not found`);
    }
  }
} 
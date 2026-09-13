import * as momentTz from 'moment-timezone';
import { isValidNumber } from 'libphonenumber-js';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';

import { UserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { OrderStatus, OrderTypeEnum, UserTypeEnum } from 'src/common/enums/user.enum';
import { IUser } from '../../common/interfaces/user.interface';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';

import { AuthService } from '../auth/auth.service';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { ASIA_CALCUTTA_TIMEZONE } from 'src/common/constants/common.constants';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';

@Injectable()
export class UserService {
  private readonly restaurantListCache = new Map<
    string,
    { expiresAt: number; value: any[] }
  >();

  constructor(
    private authService: AuthService,
    private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly httpClientService: HttpClientService,
  ) { }

  async create(createUserDto: UserDto) {
    try {
      if (!isValidNumber(createUserDto.phoneNumber, 'US')) {
        throw new BadRequestException('Invalid U.S phone number');
      }

      if (!Object.values(UserTypeEnum).includes(createUserDto.userType)) {
        throw new BadRequestException('Invalid userType value.');
      }

      const existingUser = await this.dbServices.user.findOne({
        email: createUserDto.email,
        restaurantId: createUserDto.restaurantId,
        userType: createUserDto.userType
      })

      if (existingUser) {
        if (
          existingUser?.phoneNumber === createUserDto.phoneNumber && existingUser?.email === createUserDto.email
        ) {
          throw new BadRequestException(`User already exists for this email ${createUserDto.email} with the same phone number ${createUserDto.phoneNumber} and restaurantId ${createUserDto.restaurantId}`);
        }
      }

      const user = await this.dbServices.user.create(createUserDto);

      if (user) {
        const name = user.firstName + user.lastName;
        await this.authService.signUpUserInCognito(
          user?.phoneNumber,
          name,
          user?.userId,
          user?.email, // Pass email to Cognito signup
        );
      }

      await this.authService.generateAndSendOtp(user?.email, user?.phoneNumber, createUserDto.restaurantId);

      return {
        message: 'OTP sent successfully',
        user
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error; // Re-throw the BadRequestException if it was already thrown above
      }
      throw new BadRequestException('Failed to create user: ' + error.message);
    }
  }

  async findAllUsers(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<IUser[]>> {
    const users = await this.paginationService.findAndPaginate(this.dbServices.user, {
      skip,
      limit,
      filter,
      nonPaginated
    });
    return users;
  }

  async update(userId: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.dbServices.user.findOne({ userId });
      if (!user) {
        throw new NotFoundException(`User with userId ${userId} not found`);
      }
      return await this.dbServices.user.findOneAndUpdate(
        { userId },
        updateUserDto,
        { new: true }
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update user: ' + error.message);
    }
  }

  async deleteUser(userId: string): Promise<IUser> {
    const userDetails = await this.dbServices.user.findOne({ userId });
    if (!userDetails) {
      throw new NotFoundException(`User with userId ${userId} not found.`);
    }
    return await this.dbServices.user.findOneAndUpdate({ userId }, { isDeleted: true }, { new: true });
  }

  async getAnalytics(fromDate: string, toDate: string, restaurantId: string, origin: string) {
    try {
      // Materialized view (on-demand) cache.
      // Cache key is based on the request query inputs only.
      const cacheKey = JSON.stringify({
        fromDate: fromDate || null,
        toDate: toDate || null,
        restaurantId: restaurantId || null,
        origin: origin || null,
      });
      const nowDate = new Date();
      const cachedMv = await this.dbServices.userAnalyticsMv.findOne({
        cacheKey,
        expiresAt: { $gt: nowDate },
      });
      if (cachedMv?.payload) {
        return cachedMv.payload;
      }

      const orderDateFilter: Record<string, any> = {};

      if (fromDate && toDate) {
        const startDate = momentTz.tz(fromDate, ASIA_CALCUTTA_TIMEZONE).startOf('day').toDate();
        const endDate = momentTz.tz(toDate, ASIA_CALCUTTA_TIMEZONE).endOf('day').toDate();
        orderDateFilter.orderDate = { $gte: startDate, $lte: endDate };
      }

      // Fetch restaurants from menu service via filter (origin, restaurantId, createdAt)
      const filter: Record<string, any> = {};
      if (origin) filter.restaurantOriginUrl = origin;
      if (restaurantId) filter.restaurantId = restaurantId;
      if (fromDate && toDate) filter.createdAt = { $gte: fromDate, $lte: toDate };

      const params = new URLSearchParams({ nonPaginated: 'true', filter: JSON.stringify(filter) });
      const restaurantCacheKey = params.toString();
      const cached = this.restaurantListCache.get(restaurantCacheKey);
      const nowMs = Date.now();
      let restaurantDetails: any[] = [];

      if (cached && cached.expiresAt > nowMs) {
        restaurantDetails = cached.value;
      } else {
        const restaurantResponse = await this.httpClientService.get('MENU_SERVICE', `/restaurant?${params.toString()}`, {}) as any;
        restaurantDetails = restaurantResponse?.items ?? (Array.isArray(restaurantResponse) ? restaurantResponse : []);
        this.restaurantListCache.set(restaurantCacheKey, {
          value: restaurantDetails,
          expiresAt: nowMs + 60_000,
        });
      }
      const restaurantIds = restaurantDetails.map((r: any) => r.restaurantId);

      if (restaurantIds.length === 0) {
        return {
          restaurants: []
        };
      }

      const ordersMatchBase: Record<string, any> = {
        restaurantId: { $in: restaurantIds },
        ...orderDateFilter,
      };

      const completedOrdersMatch: Record<string, any> = {
        ...ordersMatchBase,
        orderStatus: OrderStatus.ORDER_COMPLETED,
      };

      const [
        usersAggregation,
        ordersBranchAggregation,
        ordersStatusByBranchAggregation,
        totalOrdersAggregation,
        restaurantSalesAggregation,
        branchSalesAggregation,
        allBranches,
        allAdminUsers,
      ] = await Promise.all([
        this.dbServices.user.aggregate<{
          _id: string;
          totalUsers: number;
        }>([
          {
            $match: {
              restaurantId: { $in: restaurantIds },
              isDeleted: { $in: [null, false] },
            },
          },
          {
            $group: {
              _id: '$restaurantId',
              totalUsers: { $sum: 1 },
            },
          },
        ]),
        // Aggregate orders count per restaurant and branch (completed only, consistent with sales)
        this.dbServices.order.aggregate<{
          _id: {
            restaurantId: string;
            branchId: string;
          };
          count: number;
        }>([
          { $match: completedOrdersMatch },
          {
            $group: {
              _id: { restaurantId: '$restaurantId', branchId: '$branchId' },
              count: { $sum: 1 },
            },
          },
        ]),
        // Aggregate orders breakdown by status per branch (all statuses)
        this.dbServices.order.aggregate<{
          _id: {
            restaurantId: string;
            branchId: string;
            orderStatus: string;
          };
          count: number;
        }>([
          { $match: ordersMatchBase },
          {
            $group: {
              _id: {
                restaurantId: '$restaurantId',
                branchId: '$branchId',
                orderStatus: '$orderStatus',
              },
              count: { $sum: 1 },
            },
          },
        ]),
        // Aggregate total orders per restaurant (completed only, consistent with current behavior)
        this.dbServices.order.aggregate<{
          _id: string;
          totalOrders: number;
        }>([
          { $match: completedOrdersMatch },
          {
            $group: {
              _id: '$restaurantId',
              totalOrders: { $sum: 1 },
            },
          },
        ]),
        // Aggregate sales (total amount) per restaurant - only completed orders
        this.dbServices.order.aggregate<{
          _id: string;
          totalSales: number;
        }>([
          { $match: completedOrdersMatch },
          {
            $group: {
              _id: '$restaurantId',
              totalSales: { $sum: '$total' },
            },
          },
          {
            $project: {
              _id: 1,
              totalSales: { $round: ['$totalSales', 2] },
            },
          },
        ]),
        // Aggregate sales (total amount) per branch - only completed orders
        this.dbServices.order.aggregate<{
          _id: {
            restaurantId: string;
            branchId: string;
          };
          totalSales: number;
        }>([
          { $match: completedOrdersMatch },
          {
            $group: {
              _id: { restaurantId: '$restaurantId', branchId: '$branchId' },
              totalSales: { $sum: '$total' },
            },
          },
          {
            $project: {
              _id: 1,
              totalSales: { $round: ['$totalSales', 2] },
            },
          },
        ]),
        // Bulk fetch branches once (avoid N+1)
        this.dbServices.branch.find({
          restaurantId: { $in: restaurantIds },
          isDeleted: { $in: [null, false] },
        }),
        // Bulk fetch admin users once (avoid N+1)
        this.dbServices.adminUser.find({
          restaurantId: { $in: restaurantIds },
          isDeleted: { $in: [null, false] },
        }),
      ]);

      const usersCountMap = new Map(usersAggregation.map(u => [u._id, u.totalUsers]));

      // Get onboarded restaurants and branches - use provided dates or default to current week
      let onboardedStartDate: Date;
      let onboardedEndDate: Date;

      if (fromDate && toDate) {
        // Use provided date range
        onboardedStartDate = momentTz.tz(fromDate, ASIA_CALCUTTA_TIMEZONE).startOf('day').toDate();
        onboardedEndDate = momentTz.tz(toDate, ASIA_CALCUTTA_TIMEZONE).endOf('day').toDate();
      } else {
        // Default to current week
        onboardedStartDate = momentTz.tz(new Date(), ASIA_CALCUTTA_TIMEZONE).startOf('week').toDate();
        onboardedEndDate = momentTz.tz(new Date(), ASIA_CALCUTTA_TIMEZONE).endOf('week').toDate();
      }

      // Build filter for onboarded restaurants
      let onboardedRestaurantFilter: any = {
        isDeleted: { $in: [null, false] },
        createdAt: { $gte: onboardedStartDate, $lte: onboardedEndDate }
      };

      // Apply restaurantId filter if provided
      if (restaurantId) {
        onboardedRestaurantFilter.restaurantId = restaurantId;
      }

      const onboardedRestaurants = await this.dbServices.restaurant.find(onboardedRestaurantFilter);

      // Build filter for onboarded branches
      let onboardedBranchFilter: any = {
        isDeleted: { $in: [null, false] },
        createdAt: { $gte: onboardedStartDate, $lte: onboardedEndDate }
      };

      // Apply restaurantId filter if provided
      if (restaurantId) {
        onboardedBranchFilter.restaurantId = restaurantId;
      }

      // Get branches opened in the date range
      const onboardedBranches = await this.dbServices.branch.find(onboardedBranchFilter);

      // Get onboarded users - use provided dates or default to current week, with restaurantId filter if provided
      let onboardedUserFilter: any = {
        isDeleted: { $in: [null, false] },
        createdAt: { $gte: onboardedStartDate, $lte: onboardedEndDate }
      };

      // Apply restaurantId filter if provided
      if (restaurantId) {
        onboardedUserFilter.restaurantId = restaurantId;
      }

      const onboardedUsers = await this.dbServices.adminUser.find(onboardedUserFilter);

      // Group branches by restaurantId
      const branchesByRestaurant = new Map<string, Array<{ branchId: string; branchName: string }>>();
      onboardedBranches.forEach(branch => {
        if (branch.restaurantId && branch.branchId) {
          if (!branchesByRestaurant.has(branch.restaurantId)) {
            branchesByRestaurant.set(branch.restaurantId, []);
          }
          branchesByRestaurant.get(branch.restaurantId)!.push({
            branchId: branch.branchId,
            branchName: branch.name || ''
          });
        }
      });

      // Build onboarded data with restaurant and branch details
      const onboardedData = onboardedRestaurants.map(restaurant => ({
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName || '',
        branches: branchesByRestaurant.get(restaurant.restaurantId) || []
      }));

      // Build onboarded users data grouped by restaurant
      const onboardedUsersByRestaurant = new Map<string, Array<{ userName: string }>>();
      onboardedUsers.forEach(user => {
        if (user.restaurantId) {
          if (!onboardedUsersByRestaurant.has(user.restaurantId)) {
            onboardedUsersByRestaurant.set(user.restaurantId, []);
          }
          const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
          onboardedUsersByRestaurant.get(user.restaurantId)!.push({ userName });
        }
      });

      // Get restaurant names for onboarded users
      const onboardedUserRestaurantIds = Array.from(onboardedUsersByRestaurant.keys());
      const onboardedUserRestaurants = await this.dbServices.restaurant.find({
        restaurantId: { $in: onboardedUserRestaurantIds },
        isDeleted: { $in: [null, false] }
      });

      const onboardedUsersData = onboardedUserRestaurants.map(restaurant => ({
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName || '',
        users: onboardedUsersByRestaurant.get(restaurant.restaurantId) || []
      }));

      const totalOrdersMap = new Map(totalOrdersAggregation.map(o => [o._id, o.totalOrders]));
      const restaurantSalesMap = new Map(restaurantSalesAggregation.map(s => [s._id, s.totalSales]));

      // Build orders breakdown by branch map
      const ordersByBranchMap = new Map<string, Map<string, number>>();
      ordersBranchAggregation.forEach(item => {
        const restaurantId = item._id.restaurantId;
        if (!ordersByBranchMap.has(restaurantId)) {
          ordersByBranchMap.set(restaurantId, new Map());
        }
        ordersByBranchMap.get(restaurantId)!.set(item._id.branchId, item.count);
      });

      // Build sales by branch map
      const salesByBranchMap = new Map<string, Map<string, number>>();
      branchSalesAggregation.forEach(item => {
        const restaurantId = item._id.restaurantId;
        if (!salesByBranchMap.has(restaurantId)) {
          salesByBranchMap.set(restaurantId, new Map());
        }
        salesByBranchMap.get(restaurantId)!.set(item._id.branchId, item.totalSales);
      });

      // Build orders breakdown by status per branch map
      const ordersStatusByBranchMap = new Map<string, Map<string, Map<string, number>>>();
      ordersStatusByBranchAggregation.forEach(item => {
        const restaurantId = item._id.restaurantId;
        const branchId = item._id.branchId;
        const status = item._id.orderStatus;

        if (!ordersStatusByBranchMap.has(restaurantId)) {
          ordersStatusByBranchMap.set(restaurantId, new Map());
        }
        const restaurantMap = ordersStatusByBranchMap.get(restaurantId)!;

        if (!restaurantMap.has(branchId)) {
          restaurantMap.set(branchId, new Map());
        }
        restaurantMap.get(branchId)!.set(status, item.count);
      });

      // Build the response
      const branchesByRestaurantId = new Map<string, any[]>();
      allBranches.forEach((branch: any) => {
        const rid = branch?.restaurantId;
        if (!rid) return;
        if (!branchesByRestaurantId.has(rid)) branchesByRestaurantId.set(rid, []);
        branchesByRestaurantId.get(rid)!.push(branch);
      });

      const adminUsersByRestaurantId = new Map<string, any[]>();
      allAdminUsers.forEach((user: any) => {
        const rid = user?.restaurantId;
        if (!rid) return;
        if (!adminUsersByRestaurantId.has(rid)) adminUsersByRestaurantId.set(rid, []);
        adminUsersByRestaurantId.get(rid)!.push(user);
      });

      const restaurantsData = restaurantDetails.map((restaurant) => {
          const branches = branchesByRestaurantId.get(restaurant.restaurantId) || [];
          const users = adminUsersByRestaurantId.get(restaurant.restaurantId) || [];

          // Build user details
          const userDetails = {
            restaurantName: restaurant.restaurantName || '',
            users: users.map(user => ({
              userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'
            }))
          };

          const totalUsers = usersCountMap.get(restaurant.restaurantId) || 0;
          const totalOrders = totalOrdersMap.get(restaurant.restaurantId) || 0;
          const totalSales = restaurantSalesMap.get(restaurant.restaurantId) || 0;
          const ordersByBranch = ordersByBranchMap.get(restaurant.restaurantId) || new Map();
          const salesByBranch = salesByBranchMap.get(restaurant.restaurantId) || new Map();
          const ordersStatusByBranch = ordersStatusByBranchMap.get(restaurant.restaurantId) || new Map();

          // Build branches with order counts, sales, and breakdown
          const branchesWithOrders = branches
            .filter(branch => branch.branchId)
            .map(branch => {
              const branchId = branch.branchId!;
              const branchOrdersByStatus = ordersStatusByBranch.get(branchId) || new Map();

              // Convert orders by status map to object
              const ordersBreakdownByStatus: Record<string, number> = {};
              branchOrdersByStatus.forEach((count, status) => {
                ordersBreakdownByStatus[status] = count;
              });

              return {
                branchId,
                branchName: branch.name || '',
                totalOrders: ordersByBranch.get(branchId) || 0,
                totalSales: salesByBranch.get(branchId) || 0,
                ordersBreakdown: {
                  byStatus: ordersBreakdownByStatus
                }
              };
            });

          return {
            restaurantId: restaurant.restaurantId,
            restaurantName: restaurant.restaurantName || '',
            isActive: restaurant.isActive,
            onboardingProgress: restaurant.onboardingProgress ?? {},
            totalUsers,
            totalOrders,
            totalSales: totalSales.toFixed(2),
            branches: branchesWithOrders,
            userDetails
          };
        });

      // Calculate overall totals
      const totalRestaurants = restaurantDetails.length;

      const totalBranches = allBranches.length;

      // Calculate total orders across all restaurants
      const totalOrdersAll = Array.from(totalOrdersMap.values()).reduce((sum, count) => sum + count, 0);

      // Calculate total sales across all restaurants
      const totalSalesAll = Array.from(restaurantSalesMap.values()).reduce((sum, sales) => sum + sales, 0);

      // Calculate total users across all restaurants
      const totalUsersAll = Array.from(usersCountMap.values()).reduce((sum, count) => sum + count, 0);

      const overAllData = {
        totalRestaurants,
        totalBranches,
        totalOrders: totalOrdersAll,
        totalSales: totalSalesAll.toFixed(2),
        totalUsers: totalUsersAll
      };

      const responsePayload = {
        overAllData,
        restaurantsDetails: restaurantsData,
        onboardedData,
        onboardedUsersData
      };

      // Upsert MV cache (default TTL: 2 minutes)
      const ttlMs = 120_000;
      await this.dbServices.userAnalyticsMv.findOneAndUpdate(
        { cacheKey },
        {
          cacheKey,
          computedAt: new Date(),
          expiresAt: new Date(Date.now() + ttlMs),
          payload: responsePayload,
        },
        { upsert: true, new: true },
      );

      return responsePayload;
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      throw new BadRequestException('Failed to fetch user analytics: ' + error.message);
    }
  }
} 
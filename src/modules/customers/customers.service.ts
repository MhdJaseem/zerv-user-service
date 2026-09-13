import { Injectable } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { UserTypeEnum } from 'src/common/enums/user.enum';
import { RewardAdjustmentTypes } from 'src/common/enums/reward.enum';

type CustomerListItem = {
  id: string;
  type: 'registered' | 'guest';
  name: string;
  email: string;
  phone: string;
  created: Date | string;
  lastOrderOn: Date | string | null;
  followingEmail: boolean;
  followingSms: boolean;
  pointsUsed: number;
  pointsRemaining: number;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
  ) {}

  async listCustomers(
    skip = 0,
    limit = 10,
    filter: Record<string, any> = {},
    nonPaginated?: boolean
  ): Promise<IPaginatedResult<CustomerListItem>> {
    const baseFilter: Record<string, any> = { isDeleted: { $in: [null, false] } };
    if (filter.restaurantId) baseFilter.restaurantId = filter.restaurantId;
    const restaurantId = filter.restaurantId;
    const branchId = filter.branchId;

    const customerType = filter.customerType || 'all';
    if (customerType === 'registered') baseFilter.userType = UserTypeEnum.CUSTOMER;
    if (customerType === 'guest') baseFilter.userType = UserTypeEnum.Guest;

    if (branchId) {
      const userIdsWithOrdersInBranch = await this.dbServices.order.distinct('userId', {
        ...(restaurantId ? { restaurantId } : {}),
        branchId,
      });
      if (!userIdsWithOrdersInBranch || userIdsWithOrdersInBranch.length === 0) {
        return {
          totalItems: 0,
          totalPages: 1,
          skip: 0,
          limit: 0,
          items: [],
        } as IPaginatedResult<CustomerListItem>;
      }
      baseFilter['userId'] = { $in: userIdsWithOrdersInBranch };
    }

    const searchTerm = filter.search?.term;
    const searchFields = filter.search?.fields || ['firstName', 'lastName', 'email', 'phoneNumber'];

    // Fetch a single page of users (DB-side pagination)
    const paged = await this.paginationService.findAndPaginate(this.dbServices.user, {
      skip,
      limit,
      nonPaginated,
      filter: {
        ...baseFilter,
        ...(searchTerm
          ? {
              search: {
                term: searchTerm,
                fields: searchFields,
              },
            }
          : {}),
      },
      projection: {
        userId: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        phoneNumber: 1,
        userType: 1,
        restaurantId: 1,
        getPromotionalEmails: 1,
        getPromotionalTexts: 1,
        createdAt: 1,
      },
      sort: { createdAt: -1 },
    });

    const users = paged.items as any[];
    if (!users.length) {
      return { ...paged, items: [] } as IPaginatedResult<CustomerListItem>;
    }

    const userIds = users.map(u => u.userId);

    // lastOrderOn per user (scoped to branch if provided)
    const lastOrdersAgg = await this.dbServices.order.aggregate<{
      _id: string;
      lastOrderOn: Date;
    }>([
      { $match: { userId: { $in: userIds }, ...(restaurantId ? { restaurantId } : {}), ...(branchId ? { branchId } : {}) } },
      { $group: { _id: '$userId', lastOrderOn: { $max: '$createdAt' } } },
    ]);
    const userIdToLastOrderDate = new Map(lastOrdersAgg.map(o => [o._id, o.lastOrderOn]));

    // pointsRemaining
    const rewards = await this.dbServices.reward.find({ userId: { $in: userIds }, ...(restaurantId ? { restaurantId } : {}) });
    const userIdToPointsRemaining = new Map(rewards.map(r => [r['userId'], r['rewardPoints'] || 0]));

    // pointsUsed (branch aware)
    let usedAgg: { _id: string; totalUsed: number }[] = [];
    if (branchId) {
      usedAgg = await this.dbServices.rewardTransactionLog.aggregate<{
        _id: string;
        totalUsed: number;
      }>([
        { $match: { userId: { $in: userIds }, ...(restaurantId ? { restaurantId } : {}), adjustType: RewardAdjustmentTypes.SUBTRACT } },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: 'orderId',
            as: 'order'
          }
        },
        { $unwind: '$order' },
        { $match: { 'order.branchId': branchId } },
        { $group: { _id: '$userId', totalUsed: { $sum: '$quantity' } } },
      ]);
    } else {
      usedAgg = await this.dbServices.rewardTransactionLog.aggregate<{
        _id: string;
        totalUsed: number;
      }>([
        { $match: { userId: { $in: userIds }, ...(restaurantId ? { restaurantId } : {}), adjustType: RewardAdjustmentTypes.SUBTRACT } },
        { $group: { _id: '$userId', totalUsed: { $sum: '$quantity' } } },
      ]);
    }
    const userIdToPointsUsed = new Map(usedAgg.map(u => [u._id, u.totalUsed]));

    const items: CustomerListItem[] = users.map(u => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      const pointsRemaining = u.userType === UserTypeEnum.Guest ? 0 : (userIdToPointsRemaining.get(u.userId) || 0);
      const pointsUsed = u.userType === UserTypeEnum.Guest ? 0 : (userIdToPointsUsed.get(u.userId) || 0);
      return {
        id: u.userId,
        type: u.userType === UserTypeEnum.Guest ? 'guest' : 'registered',
        name,
        email: u.email || '',
        phone: u.phoneNumber || '',
        created: u['createdAt'],
        lastOrderOn: userIdToLastOrderDate.get(u.userId) || null,
        followingEmail: Boolean(u.getPromotionalEmails),
        followingSms: Boolean(u.getPromotionalTexts),
        pointsUsed,
        pointsRemaining,
      };
    });

    return { ...paged, items } as IPaginatedResult<CustomerListItem>;
  }
}




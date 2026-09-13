import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { createRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { IReward, IRewardTransactionLog } from '../../common/interfaces/reward.interface';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { isValidNumber } from 'libphonenumber-js';
import { HttpClientService } from '../../common/inter-service-communication/http-client.service';
import { AuthService } from '../auth/auth.service';
import { UserTypeEnum } from 'src/common/enums/user.enum';
import { ActionLogService } from '../../common/shared/action-log/actionLog.service';

@Injectable()
export class RewardService {
  constructor(
    private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly httpClientService: HttpClientService,
    private actionLogService: ActionLogService,
    private authService: AuthService,
  ) { }

  async create(rewardDto: createRewardDto) {
    try {
      const user = await this.dbServices.user.findOne({ userId: rewardDto.userId, userType: UserTypeEnum.CUSTOMER })
      if (!user) {
        throw new NotFoundException(`User with Id ${rewardDto.userId} is Not eligible for rewards`);
      }
      return await this.dbServices.reward.create(rewardDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error; // Re-throw the BadRequestException if it was already thrown above
      }
      throw new BadRequestException('Failed to create reward: ' + error.message);
    }
  }

  async findAllRewards(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<IReward[]>> {
    const rewards = await this.paginationService.findAndPaginate(this.dbServices.reward, {
      skip,
      limit,
      filter,
      nonPaginated
    });
    return rewards;
  }

  async getRewardSummaryByDate(
    restaurantId: string,
    start: Date,
    end: Date
  ) {
    const result = await this.dbServices.reward.aggregate([
      {
        $match: {
          restaurantId,
          isDeleted: { $in: [null, false] },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalRewardPoints: { $sum: "$rewardPoints" },
          users: { $addToSet: "$userId" }
        }
      },
      {
        $project: {
          _id: 0,
          totalRewardPoints: 1,
          totalUsers: { $size: "$users" }
        }
      }
    ]);
  
    return result[0] || {
      totalRewardPoints: 0,
      totalUsers: 0
    };
  }

  async findAllTransactionLogs(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<IRewardTransactionLog[]>> {
    const transactionlogs = await this.paginationService.findAndPaginate(this.dbServices.rewardTransactionLog, {
      skip,
      limit,
      filter,
      nonPaginated
    });
    return transactionlogs;
  }

  async update(userId: string, updateRewardDto: UpdateRewardDto) {
    try {
      const reward = await this.dbServices.reward.findOne({ userId });
      if (!reward) {
        throw new NotFoundException(`User is Not eligible for rewards`);
      }
      return await this.dbServices.reward.findOneAndUpdate(
        { userId },
        updateRewardDto,
        { new: true }
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update reward: ' + error.message);
    }
  }

  async deleteReward(userId: string): Promise<IReward> {
    const rewardDetails = await this.dbServices.reward.findOne({ userId });
    if (!rewardDetails) {
      throw new NotFoundException(`Reward for the user ${userId} not found.`);
    }
    return await this.dbServices.reward.findOneAndUpdate({ userId }, { isDeleted: true }, { new: true });
  }
} 
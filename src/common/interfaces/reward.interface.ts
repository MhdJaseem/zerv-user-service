import { RewardAdjustmentTypes } from "../enums/reward.enum";

export interface IReward {
    userId: string;
    rewardPoints: number;
    restaurantId: string;
    isDeleted?: boolean;
  }

  export interface IRewardTransactionLog {
    userId: string;
    adjustType: RewardAdjustmentTypes;
    quantity: number;
    reason: string;
    adjustedBy: string;
    restaurantId: string;
    orderId: string;
  }
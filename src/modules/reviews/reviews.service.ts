import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewTargetType } from './entities/review.entity';
import { OrderStatus } from '../../common/enums/user.enum';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly db: IMongoDBServices) { }

  async createReview(user: any, createReviewDto: CreateReviewDto, clientId?: string) {
    const { orderId, targetType, targetId, rating, comment } = createReviewDto;

    // Extract user identity from token
    const userId = createReviewDto.userId;
    const userEmail = createReviewDto.userEmail;

    const order = await this.db.order.findOne({ orderId });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify restaurant ownership if clientId is provided
    if (clientId && order.restaurantId !== clientId) {
      throw new BadRequestException('Order does not belong to this restaurant');
    }
    if (user && (order.userId !== userId && (userEmail && order.customerInfo?.email !== userEmail))) {
      this.logger.warn(`User mismatch for review on Order ${orderId}:`);
      this.logger.warn(`- Expected ID: ${order.userId} | Got: ${userId}`);
      this.logger.warn(`- Expected Email: ${order.customerInfo?.email} | Got: ${userEmail}`);
      throw new BadRequestException('You can only review your own orders');
    }

    const completedStatuses = [OrderStatus.ORDER_COMPLETED, 'completed', 'orderCompleted'];
    if (!completedStatuses.includes(order.orderStatus)) {
      throw new BadRequestException(`Reviews are only allowed after the order is completed. Current status: ${order.orderStatus}`);
    }

    const reviewData = {
      orderId,
      userId: order.userId,
      targetType,
      targetId,
      rating,
      comment,
    };

    try {
      return await this.db.review.create(reviewData);
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException('You have already reviewed this item for this order');
      }
      throw error;
    }
  }

  async getReviewAverages(targetId: string, targetType: ReviewTargetType) {
    const m = 20;
    const [targetStats, globalStats] = await Promise.all([
      this.db.review.aggregate<{ _id: string; averageRating: number; totalReviews: number }>([
        { $match: { targetId, targetType } },
        {
          $group: {
            _id: '$targetId',
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
      this.db.review.aggregate<{ averageRating: number }>([
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
          },
        },
      ]),
    ]);

    const C = globalStats.length > 0 ? globalStats[0].averageRating : 3.5; // Platform average rating

    if (!targetStats || targetStats.length === 0) {
      return { bayesianRating: parseFloat(C.toFixed(1)), totalCount: 0 };
    }

    const v = targetStats[0].totalReviews;
    const R = targetStats[0].averageRating;
    const bayesianRating = (v / (v + m)) * R + (m / (v + m)) * C;

    return {
      bayesianRating: parseFloat(bayesianRating.toFixed(1)),
      totalCount: v
    };
  }

  async getReviewsByTarget(targetId: string, targetType: ReviewTargetType) {
    try {
      const match: any = { targetId, targetType };
      return await this.db.review.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: 'orderId',
            as: 'orderDetails',
          },
        },
        { $unwind: '$orderDetails' },
      ]);
    } catch (error) {
      this.logger.error(`Error getting reviews by target: ${error}`);
      throw new BadRequestException('Error getting reviews by target');
    }
  }

  async getVisibility() {
    const visibility = await this.db.reviewVisibility.findOne({ visibilityId: 'global' });
    return visibility ? visibility.isShowReview : true; // Default fallback as true
  }

  async updateVisibility(isShowReview: boolean) {
    return await this.db.reviewVisibility.findOneAndUpdate(
      { visibilityId: 'global' },
      { isShowReview },
      { upsert: true, new: true }
    );
  }

  async updateVisibilityById(reviewId: string, isVisible: boolean) {
    try {
      return await this.db.review.findOneAndUpdate(
        { _id: reviewId },
        { isVisible },
        { new: true }
      );
    } catch (error) {
      this.logger.error(`Error updating visibility by id: ${error}`);
      throw new BadRequestException('Error updating visibility by id');
    }
  }

  async getReviewsByOrderId(orderId: string) {
    try {
      const reviews: any[] = await this.db.review.aggregate([
        {
          $match: { orderId },
        },

        {
          $facet: {
            restaurantReview: [
              {
                $match: {
                  targetType: ReviewTargetType.RESTAURANT,
                },
              },
              { $limit: 1 },
            ],

            menuReviews: [
              {
                $match: {
                  targetType: ReviewTargetType.MENU_ITEM,
                },
              },
            ],
          },
        },
      ]);

      if (!reviews || reviews.length === 0) {
        return {
          restaurantReview: null,
          menuReviews: [],
        };
      }

      return {
        restaurantReview: reviews[0].restaurantReview?.[0] || null,
        menuReviews: reviews[0].menuReviews || [],
      };
    } catch (error) {
      this.logger.error(`Error fetching reviews by orderId: ${error.message}`);
      throw new BadRequestException('Error fetching order reviews');
    }
  }
}
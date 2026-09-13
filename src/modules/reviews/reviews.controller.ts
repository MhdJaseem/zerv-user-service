import { Controller, Post, Get, Body, Param, Req, HttpStatus, HttpCode, Patch, ForbiddenException, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewTargetType } from './entities/review.entity';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) { }

  @Get('visibility')
  async getVisibility() {
    const isShowReview = await this.reviewsService.getVisibility();
    return { isShowReview };
  }

  @Patch('visibility')
  async updateVisibility(@Body() body: { isShowReview: boolean }, @Req() req) {
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
      throw new ForbiddenException('Only admin users can update this toggle');
    }
    return await this.reviewsService.updateVisibility(body.isShowReview);
  }

  @Patch('review-visibility/:reviewId')
  async updateVisibilityById(@Param('reviewId') reviewId: string, @Body() body: { isVisible: boolean }, @Req() req) {
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
      throw new ForbiddenException('Only admin users can update this toggle');
    }
    return await this.reviewsService.updateVisibilityById(reviewId, body.isVisible);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req, @Body() createReviewDto: CreateReviewDto) {
    const clientId = req['clientId'];
    return await this.reviewsService.createReview(req.user, createReviewDto, clientId);
  }

  @Get('averages/:targetType/:targetId')
  async getAverages(
    @Param('targetType') targetType: ReviewTargetType,
    @Param('targetId') targetId: string,
  ) {
    return await this.reviewsService.getReviewAverages(targetId, targetType);
  }

  @Get(':targetType/:targetId')
  async getReviews(
    @Param('targetType') targetType: ReviewTargetType,
    @Param('targetId') targetId: string,
  ) {
    return await this.reviewsService.getReviewsByTarget(targetId, targetType);
  }

  @Get('order-reviews')
  async getOrderReviews(@Query('orderId') orderId: string) {
    return this.reviewsService.getReviewsByOrderId(orderId);
  }
}

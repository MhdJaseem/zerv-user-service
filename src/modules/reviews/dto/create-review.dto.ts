import { IsString, IsEnum, IsNumber, Min, Max, IsOptional, IsNotEmpty } from 'class-validator';
import { ReviewTargetType } from '../entities/review.entity';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(ReviewTargetType)
  @IsNotEmpty()
  targetType: ReviewTargetType;

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @IsString()
  @IsOptional()
  userEmail?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  comment?: string;
}

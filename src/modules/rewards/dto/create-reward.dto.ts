import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class createRewardDto {
  @IsString()
  userId: string;

  @IsNumber()
  rewardPoints: number;

  @IsString()
  @IsOptional()
  restaurantId: string;
}
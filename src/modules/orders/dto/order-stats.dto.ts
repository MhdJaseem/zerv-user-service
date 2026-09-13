import { IsDateString, IsOptional, IsString } from 'class-validator';

export class OrderStatsQueryDto {
  @IsString()
  @IsOptional()
  branchId?: string;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  timezone?: string;
  
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}

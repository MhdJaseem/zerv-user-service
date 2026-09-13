import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ContactUsStatus } from '../entities/contact-us.entity';
import { Type } from 'class-transformer';

export class QueryContactUsDto {
  @IsEnum(ContactUsStatus)
  @IsOptional()
  status?: ContactUsStatus;

  @IsString()
  @IsOptional()
  restaurantId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number = 0;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;
}

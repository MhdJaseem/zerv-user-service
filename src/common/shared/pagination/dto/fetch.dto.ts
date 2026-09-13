import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class FetchDto {
    @IsOptional()
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    skip: number = 0;

    @IsOptional()
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    limit: number = 10;

    @IsOptional()
    @IsNotEmpty()
    @IsString()
    filter: string = '{}';

    @IsOptional()
    @IsNotEmpty()
    @IsBoolean()
    @Type(() => Boolean)
    deleted: boolean = false;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    nonPaginated: boolean;

    @IsString()
    @IsOptional()
    userId: string;

    @IsString()
    @IsOptional()
    role: string;

    @IsString()
    @IsOptional()
    @IsNotEmpty()
    page: string;

    @IsString()
    @IsOptional()
    @IsNotEmpty()
    restaurantId: string;
}
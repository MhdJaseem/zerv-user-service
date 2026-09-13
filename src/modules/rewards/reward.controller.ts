import { Controller, Get, Post, Put, Delete, Body, Param, Query,Req, HttpStatus, HttpCode, BadRequestException } from '@nestjs/common';
import { RewardService } from './reward.service';
import { createRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { Request } from 'express';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';

@Controller('rewards')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createReward(@Body() rewardDto: createRewardDto, @Req() req: Request) {
    const clientId = req['clientId'];
    rewardDto.restaurantId = clientId;
    return await this.rewardService.create(rewardDto);
  }

  @Get()
  getAllRewards(
    @Query() fetchDto: FetchDto,
    @Req() req: Request
  ) {
    const { skip, limit, filter, nonPaginated } = fetchDto;
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = req['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }
    parsedFilter['isDeleted'] = { $in: [null, false] }
    return this.rewardService.findAllRewards(skip, limit, parsedFilter,nonPaginated);
  }
  @Get('by-date')
  async getRewardSummaryByDate(
  @Query('date') date: string,
  @Req() req: Request
  ) {
  const clientId = req['clientId'];

  const start = new Date(date);
  const end = new Date(date);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return this.rewardService.getRewardSummaryByDate(
    clientId,
    start,
    end
  );
}

  @Put(':id')
  async updateReward(
    @Param('id') userId: string,
    @Body() updateRewardDto: UpdateRewardDto
  ) {
    return await this.rewardService.update(userId, updateRewardDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReward(@Param('id') id: string) {
    await this.rewardService.deleteReward(id);
  }

  @Get('transaction-logs')
  getAllTransactionLogs(
    @Query() fetchDto: FetchDto,
    @Req() req: Request
  ) {
    const { skip, limit, filter, nonPaginated } = fetchDto;
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = req['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }
    
    return this.rewardService.findAllTransactionLogs(skip, limit, parsedFilter,nonPaginated);
  }
} 
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { Request, Response } from 'express';
import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpStatus, HttpCode, Req, Patch, Res, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatsQueryDto } from './dto/order-stats.dto';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';
import { IPaymentInfo } from 'src/common/interfaces/payment.interface';
import { OrderStats } from 'src/common/interfaces/order.interface';
import { OrdersService } from './orders.service';
import { FetchDtoCoupon } from '../coupons/dto/fetch-coupon.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() request: Request, @Body() createOrderDto: CreateOrderDto) {
    const clientId = request['clientId'];
    createOrderDto.restaurantId = clientId;
    return await this.ordersService.create(createOrderDto);
  }

  @Get()
  getAllOrders(
    @Req() request: Request,
    @Query() fetchDto: FetchDto,
  ) {
    const { skip, limit, filter, nonPaginated } = fetchDto;
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = request['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }

    parsedFilter['isDeleted'] = { $in: [null, false] };

    return this.ordersService.findAllOrders(skip, limit, parsedFilter, nonPaginated);
  }

  @Get("/orders-manager")
  getAllOrdersManagerOrders(
    @Req() request: Request,
    @Query() fetchDto: FetchDto,
    @Query('nonPaginated') nonPaginated: boolean
  ) {
    const { skip, limit, filter } = fetchDto;
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = request['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }

    parsedFilter['isDeleted'] = { $in: [null, false] };

    return this.ordersService.getAllOrdersManagerOrders(skip, limit, parsedFilter, nonPaginated);
  }

  @Get('stats/dashboard')
  async getOrderStats(
    @Req() request: Request,
    @Query() queryDto: OrderStatsQueryDto
  ): Promise<OrderStats> {
    const clientId = request['clientId'];
    return await this.ordersService.getOrderStats(clientId, queryDto);
  }

  @Get('stats/daily-sales')
  async getDailySalesStats(
    @Req() request: Request,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('branchId') branchId?: string,
    @Query('timezone') timezone: string = 'America/New_York'
  ): Promise<any> {
    const rawClientId = request['clientId'];
    const clientId = typeof rawClientId === 'string' ? rawClientId : '';
    return await this.ordersService.getDailySalesStats(clientId, timezone, fromDate, toDate, branchId);
  }

  @Get('export/csv')
  async exportOrdersToCSV(
    @Req() request: Request,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('branchId') branchId?: string,
    @Query('orderStatus') orderStatus?: string
  ) {
    try {
      const clientId = request['clientId'];
      const filePath = await this.ordersService.generateOrdersCSV(
        clientId,
        fromDate,
        toDate,
        branchId,
        orderStatus
      );

      const fileStream = createReadStream(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      res.setHeader('Content-Type', 'text/csv');

      fileStream.pipe(res);

      fileStream.on('end', () => {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    } catch (error) {
      throw new BadRequestException(`Failed to export CSV: ${error.message}`);
    }
  }

  @Get('user/history')
  async getOrdersHistory(@Req() request: Request, @Query() fetchDto: FetchDto) {
    const { skip, limit, filter, nonPaginated } = fetchDto;
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = request['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }

    parsedFilter['isDeleted'] = { $in: [null, false] };

    return this.ordersService.getUserOrders(
      skip,
      limit,
      parsedFilter,
      nonPaginated,
    );
  }

  @Get('fetch/today-orders')
  async getTodayOrders(@Req() request: Request, @Query() fetchDto: FetchDtoCoupon) {
    const { skip, limit, filter, page, nonPaginated } = fetchDto;
    const shouldPaginate = nonPaginated === 'true' ? true : false;
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = request['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }
    parsedFilter['isDeleted'] = { $in: [null, false] };
    return this.ordersService.getTodayOrders(
      skip,
      limit,
      parsedFilter,
      shouldPaginate,
      page
    );
  }

  @Get('trending-products')
  async getTrendingProducts(
    @Req() request: Request,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    const clientId = request['clientId'];
    const skipNum = Math.max(0, Number(skip) || 0);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    return await this.ordersService.getTrendingProducts(clientId, skipNum, limitNum);
  }

  @Get(':id')
  async findOne(@Param('id') orderId: string) {
    return await this.ordersService.findById(orderId);
  }

  @Put(':id')
  async update(
    @Param('id') orderId: string,
    @Body() updateOrderDto: UpdateOrderDto
  ) {
    return await this.ordersService.update(orderId, updateOrderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') orderId: string) {
    await this.ordersService.delete(orderId);
  }

  @Patch(':id/payment-status')
  async updatePaymentStatus(
    @Param('id') paymentId: string,
    @Body() paymentInfo: IPaymentInfo
  ) {
    return await this.ordersService.updatePaymentStatus(paymentId, paymentInfo);
  }

  @Patch(':branchId/accept')
  async acceptBranchOrders(@Param('branchId') branchId: string) {
    return await this.ordersService.acceptBranchOrders(branchId);
  }

  @Post('email/:orderId')
  async sendEmail(@Param('orderId') orderId: string) {
    return await this.ordersService.sendEmail(orderId);
  }
}
import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, CreateCouponLogsDto } from './dto/coupons.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { FetchDtoCoupon } from './dto/fetch-coupon.dto';

@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
  ) {}

  @Post('create')
  async createCoupon(
    @Body() createCouponDto: CreateCouponDto,
  ) {
    return this.couponsService.createCoupons(createCouponDto);
  }

  @Get()
  async listCoupons(
    @Req() request: Request,
    @Query() fetchDto: FetchDtoCoupon,
  ) {
    const { skip, limit, filter, nonPaginated, userId } = fetchDto;
    const shouldPaginate = nonPaginated === 'true' ? true : false;    
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = request['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }
    parsedFilter['isDeleted'] = { $in: [null, false] }
    return this.couponsService.listCoupons(skip, limit, parsedFilter, shouldPaginate, userId);
  }

  @Get('details/:id')
  async getCouponDetails(@Param('id') couponId: string) {
    return this.couponsService.getCouponDetails(couponId);
  }

  @Get('couponCode/details/:id')
  async getCouponDetailsWithCode(@Param('id') couponCode: string) {
    return this.couponsService.getCouponDetailsWithCode(couponCode);
  }

  @Put('update/:id')
  async updateCoupon(
    @Param('id') couponId: string,
    @Body() updateData: UpdateCouponDto,
  ) {
    return this.couponsService.updateCoupon(couponId, updateData);
  }

  @Post('delete/:id')
  async deleteCoupon(@Param('id') couponId: string) {
    return this.couponsService.deleteCoupon(couponId);
  }

  @Post('create-couponlogs')
  async createCouponLogs(
    @Body() createCouponLogsDto: CreateCouponLogsDto,
  ) {
    return this.couponsService.createCouponLogs(createCouponLogsDto);
  }

  @Get('get-couponlogs')
  async getCouponLogs() {
    return this.couponsService.getCouponLogs();
  }
}

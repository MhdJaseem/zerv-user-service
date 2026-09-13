import * as momentz from 'moment-timezone';
import { BadRequestException, Injectable } from '@nestjs/common';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { CreateCouponDto, CreateCouponLogsDto } from './dto/coupons.dto';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { CouponRedeemedStatus } from 'src/common/enums/cart.enum';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    private readonly dbService: IMongoDBServices, 
    private readonly paginationService: PaginationService, 
    private readonly httpClientService: HttpClientService) 
    {}

  public async createCoupons(createCouponDto: CreateCouponDto): Promise<any> {
    const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${createCouponDto.branchId}`);
    const expiryDateUTC = momentz.tz(createCouponDto.expiryDate, branch.timezone).utc().toDate();
    const existingCoupon = await this.dbService.coupon.findOne({
      branchId: createCouponDto.branchId,
      couponCode: createCouponDto.couponCode,
    }); 

    if (existingCoupon) {
      throw new BadRequestException('Coupon already exists');
    }

    // Create coupon data with UTC date
    if (createCouponDto.discountType === 'bogo') {
      if (!createCouponDto.targetProductId) {
        throw new BadRequestException('BOGO coupons require a targetProductId');
      }
      // Ignore discountValue, maxDiscountAmount, minOrderAmount for BOGO
      createCouponDto.discountValue = 0;
      createCouponDto.maxDiscountAmount = 0;
      createCouponDto.minOrderAmount = 0;
    }
    const couponData = {
      ...createCouponDto,
      expiryDate: new Date(expiryDateUTC)
    };

    const coupon = await this.dbService.coupon.create(couponData);
    if (!coupon) {
      throw new BadRequestException('Failed to create coupon');
    }
    return coupon;
  }
 
 
  public async listCoupons(
    skip: number,
    limit: number,
    filter: Record<string, any>,
    nonPaginated: boolean,
    userId: string
  ) {
    delete filter.restaurantId;
  
    const couponLogs = await this.dbService.couponlog.find({
      branchId: filter.branchId,
      userId,
      redeemedStatus: { $in: [CouponRedeemedStatus.PENDING, CouponRedeemedStatus.REDEEMED] },
    });
  
    // Create a map of coupon codes to their usage count
    const couponUsageMap = new Map();
    couponLogs.forEach(log => {
      couponUsageMap.set(log.couponCode, log.maxRedemptions);
    });
  
    const today = momentz.tz().startOf('day').utc().toDate();
  
    if (userId) {
      filter.expiryDate = { $gte: today };
      filter.isActive = true;
    }
  
    const coupons = await this.paginationService.findAndPaginate(
      this.dbService.coupon,
      { skip, limit, filter, nonPaginated }
    );
  
    let items = coupons.items;
    if (nonPaginated) {
      items = items.filter(coupon => {
        const usageCount = couponUsageMap.get(coupon.couponCode) || 0;
        return usageCount < (coupon.maxRedemptions || 1) && coupon.expiryDate > today;
      });
    }
  
    return {
      ...coupons,
      items
    };
  }

  public async getCouponDetails(couponId: string): Promise<any> {
    const coupon = await this.dbService.coupon.findOne({ couponId: couponId });
    if (!coupon) {
      throw new BadRequestException('Coupon not found');
    }
    return coupon;
  }

  public async getCouponDetailsWithCode(couponCode: string): Promise<any> {
    const coupon = await this.dbService.coupon.findOne({ couponCode: couponCode });
    if (!coupon) {
      throw new BadRequestException('Coupon not found');
    }
    return coupon;
  }

  public async updateCoupon(couponId: string, updateData: UpdateCouponDto): Promise<any> {
    // First check if the coupon exists
    const existingCoupon = await this.dbService.coupon.findOne({ couponId });
    if (!existingCoupon) {
      throw new BadRequestException('Coupon not found');
    }

    // If couponCode is being updated, check for duplicates
    if (updateData.couponCode && updateData.couponCode !== existingCoupon.couponCode) {
      const duplicateCoupon = await this.dbService.coupon.findOne({
        branchId: updateData.branchId,
        couponCode: updateData.couponCode,
        couponId: { $ne: couponId } // Exclude current coupon from check
      });

      if (duplicateCoupon) {
        throw new BadRequestException('Coupon code already exists for this branch');
      }
    }
    
    const branch: any = await this.httpClientService.get('MENU_SERVICE', `/branch/${updateData.branchId}`);
    if(updateData.expiryDate) {
      const expiryDateUTC = momentz.tz(updateData.expiryDate, branch.timezone).clone().utc().toDate();
      updateData.expiryDate = new Date(expiryDateUTC);
    }

    const coupon = await this.dbService.coupon.findOneAndUpdate(
      { couponId },
      { $set: updateData },
      { new: true },
    );
    
    if (!coupon) {
      throw new BadRequestException('Failed to update coupon');
    }
    return coupon;
  }

  public async deleteCoupon(couponId: string): Promise<any> {
    const coupon = await this.dbService.coupon.findOneAndDelete({ couponId });
    if (!coupon) {
      throw new BadRequestException('Failed to delete coupon');
    }
    return 'Coupon deleted successfully';
  }

  /* Coupons Logs */
  public async createCouponLogs(createCouponLogDto: CreateCouponLogsDto): Promise<any> {
    const existingLog = await this.dbService.couponlog.findOne({
      couponId: createCouponLogDto.couponCode,
      userId: createCouponLogDto.userId,
      orderId: createCouponLogDto.orderId,
      branchId: createCouponLogDto.branchId,
    });

    if (existingLog) {
      throw new BadRequestException('Coupon log already exists for this user and order');
    }

    const couponLog = await this.dbService.couponlog.create(createCouponLogDto);
    if (!couponLog) {
      throw new BadRequestException('Failed to create coupon log');
    }

    return couponLog;
  }

  public async getCouponLogs(): Promise<any> {
    const couponLogs = await this.dbService.couponlog.find({});
    if (!couponLogs) {
      throw new BadRequestException('Failed to fetch coupon logs');
    }
    return couponLogs;
  }

  public async updateCouponLogStatus(couponLogId: string,status: string): Promise<any> {
    const couponLog = await this.dbService.couponlog.findOneAndUpdate(
      { couponLogsId: couponLogId },
      { redeemedStatus: status },
      { new: true },
    );

    if (!couponLog) {
      throw new BadRequestException('Failed to update coupon log status');
    }

    return couponLog;
  }

  public async deleteCouponLog(couponLogId: string): Promise<any> {
    const couponLog = await this.dbService.couponlog.findOneAndDelete({ couponLogsId: couponLogId });
    if (!couponLog) {
      throw new BadRequestException('Failed to delete coupon log');
    }
    return 'Coupon log deleted successfully';
  }
}

import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CustomersService } from './customers.service';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';

@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(
    @Query() fetchDto: FetchDto,
    @Req() req: Request
  ) {
    const { skip, limit, filter, nonPaginated } = fetchDto;
    let parsedFilter: Record<string, any> = {};
    try {
      parsedFilter = filter ? JSON.parse(filter) : {};
    } catch (_) {
      parsedFilter = {};
    }
    const restaurantId = req['clientId'];
    parsedFilter.restaurantId = restaurantId;
    return this.customersService.listCustomers(skip, limit, parsedFilter, nonPaginated);
  }
}



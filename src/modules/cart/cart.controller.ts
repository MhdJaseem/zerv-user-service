import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpStatus, HttpCode, Req } from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { Request } from 'express';
import { ICart } from 'src/common/interfaces/cart.interface';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Put('/:userId')
  @HttpCode(HttpStatus.CREATED)
  async appendCart(
    @Param('userId') userId: string,
    @Body() cartDto: CreateCartDto,
    @Req() req: Request
  ): Promise<ICart> {
    const clientId = req['clientId'];
    cartDto.restaurantId = clientId;
    return this.cartService.appendCart(userId, cartDto);
  }

  @Get()
  getAllCarts(
    @Req() request: Request,
    @Query() fetchDto: FetchDto,
  ) {
    const { skip, limit, filter, deleted, nonPaginated } = fetchDto;
    let parsedFilter;
    try {
      parsedFilter = JSON.parse(filter);
      const clientId = request['clientId'];
      parsedFilter.restaurantId = clientId;
    } catch (e) {
      parsedFilter = {};
    }
    parsedFilter['isDeleted'] = { $in: [null, false] }
    return this.cartService.findAllCart(skip, limit, parsedFilter,nonPaginated);
  }

  @Get('user/:userId')
  async getUserCart(@Param('userId') userId: string) {
    return await this.cartService.findByUserId(userId);
  }

  @Put(':id')
  async updateCart(
    @Param('id') cartId: string,
    @Body() updateCartDto: UpdateCartDto
  ) {
    return await this.cartService.update(cartId, updateCartDto);
  }

  @Delete(':userId')
  async deleteCart(@Param('userId') userId: string): Promise<void> {
    return this.cartService.deleteCart(userId);
  }
} 
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, HttpStatus, HttpCode } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request } from 'express';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() userDto: UserDto, @Req() req: Request) {
    const clientId = req['clientId'];
    userDto.restaurantId = clientId;
    return await this.userService.create(userDto);
  }

  @Get()
  getAllUsers(
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
    return this.userService.findAllUsers(skip, limit, parsedFilter, nonPaginated);
  }

  @Put(':id')
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return await this.userService.update(userId, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
  }

  @Get('analytics')
  async getAnalytics(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('restaurantId') restaurantId: string,
    @Query('origin') origin: string
  ) {
    return await this.userService.getAnalytics(fromDate, toDate, restaurantId, origin);
  }
} 
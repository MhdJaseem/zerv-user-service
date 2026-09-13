import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, HttpStatus, HttpCode, BadRequestException, Patch, NotFoundException } from '@nestjs/common';
import { AdminUserService } from './admin-user.service';
import { AdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { Request } from 'express';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { superAdminAllowedOrigins } from 'src/common/constants/service-common.constants';

@Controller('admin-user')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) { }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createAdminUser(@Body() adminUserDto: AdminUserDto, @Req() req: Request) {
    const rawClientId = req['clientId'];
    const clientId = typeof rawClientId === 'string' ? rawClientId : '';
    adminUserDto.restaurantId = clientId;
    return await this.adminUserService.createAdminUser(adminUserDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  getAllAdminUsers(
    @Query() fetchDto: FetchDto,
    @Req() req: Request
  ) {
    const { skip, limit, filter, nonPaginated, role, restaurantId } = fetchDto;
    let parsedFilter: Record<string, any> = {};
    try {
      if (filter) {
        parsedFilter = JSON.parse(filter);
      }

      if (restaurantId) {
        parsedFilter['restaurantId'] = restaurantId;
      }

      const origin = req.headers.origin as string;
      const isSuperAdminConsole = superAdminAllowedOrigins.includes(origin);
      const restaurantIdQuery = req.query.restaurantId as string;

      if (role) {
        parsedFilter['role'] = role;
      }

      const clientId = req['clientId'];
      if (isSuperAdminConsole) {
        if (restaurantIdQuery) {
          parsedFilter['restaurantId'] = restaurantIdQuery;
        }
      } else {
        if (clientId && !parsedFilter['restaurantId']) {
          parsedFilter['restaurantId'] = clientId;
        }
      }

    } catch (e) {
      parsedFilter = {};
    }
    parsedFilter['isDeleted'] = { $in: [null, false] }
    return this.adminUserService.findAllAdminUsers(skip, limit, parsedFilter, nonPaginated);
  }

  @Get(':adminId')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('adminId') adminId: string) {
    return this.adminUserService.getAdminUserById(adminId);
  }

  @Put(':adminId')
  @HttpCode(HttpStatus.OK)
  async updateAdminUser(
    @Param('adminId') adminId: string,
    @Body() updateAdminUserDto: UpdateAdminUserDto
  ) {
    return await this.adminUserService.update(adminId, updateAdminUserDto);
  }

  @Patch(':adminId/password')
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Param('adminId') adminId: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Query('forgotPassword') forgotPassword: boolean
  ) {
    try {
      const updatedAdmin = await this.adminUserService.updatePassword(adminId, updatePasswordDto, forgotPassword);
      return { message: 'Password updated successfully', adminId: updatedAdmin.adminId };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Unable to update the password');
    }
  }

  @Delete(':adminId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('adminId') adminId: string) {
    return this.adminUserService.deleteAdminUser(adminId);
  }
} 
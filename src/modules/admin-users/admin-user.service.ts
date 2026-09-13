import { FilterQuery } from 'mongoose';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';

import { AdminUserDto } from './dto/create-admin-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { IAdminUser } from '../../common/interfaces/admin-user.interface';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { AttributeAccess, AttributeNames, AdminRoles } from 'src/common/enums/user.enum';

@Injectable()
export class AdminUserService {
  constructor(
    private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService
  ) { }

  async createAdminUser(createAdminDto: AdminUserDto): Promise<IAdminUser> {
    try {
      const existingAdmin = await this.dbServices.adminUser.findOne({ email: createAdminDto.email });

      if (existingAdmin && !existingAdmin.isDeleted) {
        throw new BadRequestException('Admin with this email already exists');
      }

      if (!createAdminDto.abilities) {
        createAdminDto.abilities = [];
      }

      if (createAdminDto.role === AdminRoles.SUPER_ADMIN && createAdminDto.abilities.length === 0) {
        for (const attributeName of Object.values(AttributeNames)) {
          createAdminDto.abilities.push({
            attributeName,
            attributeAccess: [AttributeAccess.ALL],
          });
        }
      } else if (createAdminDto.role === AdminRoles.ADMIN && createAdminDto.restaurantId) {
        if (createAdminDto.abilities.length === 0) {
          for (const attributeName of Object.values(AttributeNames)) {
            createAdminDto.abilities.push({
              attributeName,
              attributeAccess: [AttributeAccess.ALL],
            });
          }
        }
      }

      const adminData: any = {
        ...createAdminDto,
        abilities: createAdminDto.abilities,
        branchId: createAdminDto.branchId ? [createAdminDto.branchId] : undefined,
        authProvider: createAdminDto.authProvider ?? 'email',
        isDeleted: false,
      };

      if (existingAdmin) {
        if (!createAdminDto.adminId) {
          delete adminData.adminId;
        }
        return await this.dbServices.adminUser.findOneAndUpdate(
          { email: createAdminDto.email },
          adminData,
          { new: true }
        );
      }

      const createdAdmin = await this.dbServices.adminUser.create(adminData);

      return createdAdmin;
    } catch (error) {
      console.error('Error creating admin user:', error);
      throw new BadRequestException(error.message);
    }
  }

  async findAllAdminUsers(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<IAdminUser[]>> {
    try {
      filter.isDeleted = { $in: [null, false] };
      const users = await this.paginationService.findAndPaginate(this.dbServices.adminUser, {
        skip,
        limit,
        filter,
        nonPaginated
      });
      return users as IPaginatedResult<IAdminUser[]>;
    } catch (error) {
      console.error('Error finding all admin users:', error);
      throw new BadRequestException('Failed to find all admin users: ' + error.message);
    }
  }

  async getAdminUserById(adminId: string): Promise<IAdminUser> {
    try {
      const adminUser = await this.dbServices.adminUser.findOne({ adminId, isDeleted: { $in: [null, false] } });

      if (!adminUser) {
        throw new NotFoundException('Admin user not found');
      }

      return adminUser;
    } catch (error) {
      console.error('Error getting admin user by id:', error);
      throw new BadRequestException('Failed to get admin user by id: ' + error.message);
    }
  }

  async update(adminId: string, updateAdminUserDto: UpdateAdminUserDto) {
    try {
      const adminUser = await this.dbServices.adminUser.findOne({ adminId, isDeleted: { $in: [null, false] } });
      if (!adminUser) {
        throw new NotFoundException(`AdminUser with adminId ${adminId} not found`);
      }
      const role = updateAdminUserDto.role || adminUser.role;

      // Only assign default abilities if none are provided in the DTO AND the user has no existing abilities AND restaurantId is present
      if (
        !updateAdminUserDto.abilities &&
        (!adminUser.abilities || adminUser.abilities.length === 0) &&
        (updateAdminUserDto.restaurantId || adminUser.restaurantId)
      ) {
        const abilities: any[] = [];
        if (role === AdminRoles.SUPER_ADMIN) {
          for (const attributeName of Object.values(AttributeNames)) {
            abilities.push({
              attributeName,
              attributeAccess: [AttributeAccess.ALL],
            });
          }
        } else if (role === AdminRoles.ADMIN) {
          for (const attributeName of Object.values(AttributeNames)) {
            abilities.push({
              attributeName,
              attributeAccess: [AttributeAccess.ALL],
            });
          }
        }
        if (abilities.length > 0) {
          updateAdminUserDto.abilities = abilities;
        }
      }

      return await this.dbServices.adminUser.findOneAndUpdate(
        { adminId },
        updateAdminUserDto,
        { new: true }
      );
    }
    catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update adminUser: ' + error.message);
    }
  }

  async updatePassword(adminId: string, updatePasswordDto: UpdatePasswordDto, forgotPassword: boolean): Promise<IAdminUser> {
    try {
      const adminUser = await this.dbServices.adminUser.findOne({ adminId, isDeleted: { $in: [null, false] } });
      if (!adminUser) {
        throw new NotFoundException('Admin user not found');
      }

      if (!forgotPassword) {
        if (updatePasswordDto.currentPassword != adminUser.password) {
          throw new BadRequestException('Current password is incorrect');
        }
      } else {
        throw new BadRequestException('Method not implemented');
      }
      return await this.dbServices.adminUser.findOneAndUpdate({ adminId }, { password: updatePasswordDto.newPassword });
    } catch (error) {
      console.error('Error updating password:', error);
      throw new BadRequestException('Failed to update password: ' + error.message);
    }
  }

  async deleteAdminUser(adminId: string) {
    try {
      const adminUser = await this.dbServices.adminUser.findOne({ adminId, isDeleted: { $in: [null, false] } });

      if (!adminUser) {
        throw new NotFoundException('Admin user not found');
      }

      return await this.dbServices.adminUser.findOneAndUpdate({ adminId }, { isDeleted: true }, { new: true });
    } catch (error) {
      console.error('Error deleting admin user:', error);
      throw new BadRequestException('Failed to delete admin user: ' + error.message);
    }
  }

  async getOneAdminUser(filter: FilterQuery<IAdminUser>) {
    try {
      filter.isDeleted = { $in: [null, false] };
      const adminUser = await this.dbServices.adminUser.findOne(filter);

      if (!adminUser) {
        throw new NotFoundException('User not found!');
      }

      return adminUser;
    } catch (error) {
      console.error('Error getting one admin user:', error);
      throw new BadRequestException(error.message);
    }
  }

  async updateRefreshToken(adminId: string, refreshToken: string) {
    return await this.dbServices.adminUser.findOneAndUpdate({ adminId }, { refreshToken });
  }
} 
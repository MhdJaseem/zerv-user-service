import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  Query,
} from '@nestjs/common';
import { AddressService } from './address.service';
import {
  CreateAddressDto,
  LocateUserQueriesDto,
} from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) { }

  @Get('locate')
  async locateUser(@Query() locateUserQueriesDto: LocateUserQueriesDto) {
    const { lat, long } = locateUserQueriesDto;
    return await this.addressService.locateUser(lat, long);
  }

  @Get('geocode')
  async getGeoLocationInfo(
    @Query('query') query: string,
    @Query('placeId') placeId: string,
  ) {
    return await this.addressService.getGeoLocationInfo(query, placeId);
  }

  @Get('auto-complete')
  async autoCompletePlaceDetails(@Query('query') query: string) {
    return await this.addressService.autoCompletePlaceDetails(query);
  }

  @Get('place-details')
  async placeDetailsByPlaceId(@Query('placeId') placeId: string) {
    return await this.addressService.placeDetailsByPlaceId(placeId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAddress(@Body() createAddressDto: CreateAddressDto) {
    return await this.addressService.create(createAddressDto);
  }

  @Get(':userId')
  async getUserAddresses(@Param('userId') userId: string) {
    return await this.addressService.findByUserId(userId);
  }

  @Put(':id')
  async updateAddress(
    @Param('id') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto
  ) {
    return await this.addressService.update(addressId, updateAddressDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAddress(@Param('id') addressId: string) {
    await this.addressService.delete(addressId);
  }
}

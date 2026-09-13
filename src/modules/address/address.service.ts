import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { IAddress } from '../../common/interfaces/address.interface';
import { MapService } from '../../common/mapProviders/mapService';

@Injectable()
export class AddressService {
  constructor(private dbServices: IMongoDBServices,
    private mapService: MapService,) { }

  async locateUser(lat: number, long: number) {
    return await this.mapService.reverseGeoCode(lat, long);
  }
  
  async getGeoLocationInfo(query: string, placeId: string) {
    return await this.mapService.forwardGeoCode(query, placeId);
  }

  async autoCompletePlaceDetails(query: string) {
    return await this.mapService.placeAutocomplete(query);
  }

  async placeDetailsByPlaceId(placeId: string) {
    return await this.mapService.placeDetails(placeId);
  }

  async create(createAddressDto: CreateAddressDto): Promise<IAddress> {
    try {
      const address = await this.dbServices.address.create(createAddressDto);
      return address;
    } catch (error) {
      throw new BadRequestException('Failed to create address: ' + error.message);
    }
  }


  async findByUserId(userId: string): Promise<IAddress[]> {
    return await this.dbServices.address.find({ userId });
  }

  async update(addressId: string, updateAddressDto: UpdateAddressDto): Promise<IAddress> {
    const address = await this.dbServices.address.findOneAndUpdate(
      { addressId },
      updateAddressDto,
      { new: true }
    );
    if (!address) {
      throw new NotFoundException(`Address with ID ${addressId} not found`);
    }
    return address;
  }

  async delete(addressId: string): Promise<void> {
    const result = await this.dbServices.address.findOneAndDelete({ addressId });
    if (!result) {
      throw new NotFoundException(`Address with ID ${addressId} not found`);
    }
  }
}

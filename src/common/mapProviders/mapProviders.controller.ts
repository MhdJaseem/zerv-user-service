import { Controller, Get, Query } from '@nestjs/common';
import { MapProvidersService } from './mapProviders.service';

@Controller('map-providers')
export class MapProvidersController {
    constructor(private readonly mapService: MapProvidersService) { }

    @Get('locate-address')
    async reverseGeocode(@Query('lat') lat: number, @Query('long') long: number) {
        return this.mapService.reverseGeoCode(lat, long);
    }

    @Get('directions')
    async directions(@Query('fromLat') fromLat: number, @Query('fromLong') fromLong: number, @Query('toLat') toLat: number, @Query('toLong') toLong: number) {
        return this.mapService.directions(fromLat, fromLong, toLat, toLong);
    }

    @Get('forward-geocode')
    async forwardGeocode(@Query('query') query: string) {
        return this.mapService.forwardGeoCode(query);
    }

    @Get('place-autocomplete')
    async placeAutocomplete(@Query('input') input: string) {
        return this.mapService.placeAutocomplete(input);
    }

    @Get('place-details')
    async placeDetails(@Query('placeId') placeId: string) {
        return this.mapService.placeDetails(placeId);
    }
}
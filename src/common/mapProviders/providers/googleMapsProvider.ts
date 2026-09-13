import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  Client,
  PlaceAutocompleteResponse,
  PlaceDetailsResponseData,
} from '@googlemaps/google-maps-services-js';
import { MapsProvider } from '../../enums/address.enum';
import { Helpers } from '../../helpers/common.helpers';

export class GoogleMapsProvider {
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api';
  private readonly apiKey: string;
  private readonly axiosInstance: AxiosInstance;
  private readonly googleMapsClient: Client;
  private readonly logger = new Logger(GoogleMapsProvider.name);

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_CLIENT_KEY || '';
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_MAPS_CLIENT_KEY environment variable is not set. Some features may not work correctly.');
    }
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 2000,
      headers: { Accept: 'application/json' },
    });
    this.googleMapsClient = new Client({});
  }

  public async reverseGeoCode(lat: number, long: number): Promise<any> {
    const response = await this.axiosInstance.get('/geocode/json', {
      params: {
        latlng: `${lat},${long}`,
        key: this.apiKey,
        result_type:
          'street_address|administrative_area_level_1|administrative_area_level_2|administrative_area_level_3|administrative_area_level_4|administrative_area_level_5|colloquial_area|locality|sublocality|postal_code|premise|subpremise',
      },
    });

    const data = response.data;
    if (data) {
      delete data.plus_code;
      delete data.status;
    }

    return {
      ...this.buildAddress(data),
      ...data,
      provider: MapsProvider.GOOGLE,
    };
  }

  public async forwardGeoCode(query: string, placeId?: string): Promise<any> {
    const params: any = { key: this.apiKey };

    if (placeId) {
      params.place_id = placeId;
    } else if (query) {
      params.address = query;
      params.result_type =
        'street_address|administrative_area_level_1|administrative_area_level_2|administrative_area_level_3|administrative_area_level_4|administrative_area_level_5|colloquial_area|locality|sublocality|postal_code|premise|subpremise';
    }

    const response = await this.axiosInstance.get('/geocode/json', { params });

    const data = response.data;
    if (data) {
      delete data.plus_code;
      delete data.status;
    }

    return {
      ...this.buildAddress(data),
      ...data,
      provider: MapsProvider.GOOGLE,
    };
  }

  public async placeAutocomplete(
    params: string,
  ): Promise<PlaceAutocompleteResponse> {
    const response = await this.axiosInstance.get('/place/autocomplete/json', {
      params: {
        key: this.apiKey,
        input: params,
        components: 'country:IN',
      },
    });

    return response.data;
  }

  public async placeDetails(
    placeId: string,
  ): Promise<PlaceDetailsResponseData> {
    try {
      const { data } = await this.googleMapsClient.placeDetails({
        params: {
          place_id: placeId,
          key: this.apiKey,
          fields: ['geometry'],
        },
      });
      return data;
    } catch (error) {
      console.error('Error fetching place details:', error);
      throw error;
    }
  }

  public async directions(
    fromLat: number,
    fromLong: number,
    toLat: number,
    toLong: number,
  ): Promise<{ distance: number; duration: number }> {
    const { data } = await this.googleMapsClient.directions({
      params: {
        origin: [fromLat, fromLong],
        destination: [toLat, toLong],
        key: this.apiKey,
      },
    });

    const directionsResponseData = {
      distance: 0,
      duration: 0,
    };

    if (data.routes?.[0]?.legs?.[0]) {
      const leg = data.routes[0].legs[0];
      directionsResponseData.distance = leg.distance?.value ?? 0;
      directionsResponseData.duration = Helpers.secondsToMinutes(
        leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0,
      );
    }

    return directionsResponseData;
  }

  public buildAddress(mapData: any): any {
    if (!mapData?.results?.[0]) {
      return {};
    }

    const addressComponents = mapData.results.flatMap(
      (result) => result.address_components || [],
    );
    const extractComponent = (type: string) =>
      Helpers.maximumOccurrences(
        addressComponents
          .filter((comp) => comp.types.includes(type))
          .map((comp) => comp.long_name),
      );

    const address = Helpers.removePlusCode(
      mapData.results[0].formatted_address,
    );

    if (mapData.results[0]) {
      mapData.results[0].location = mapData.results[0].geometry.location;
    }

    return {
      address: address || '',
      pincode: extractComponent('postal_code') || '',
      locality:
        extractComponent('sublocality') ||
        extractComponent('locality') ||
        extractComponent('administrative_area_level_3') ||
        extractComponent('administrative_area_level_2') ||
        extractComponent('administrative_area_level_1') ||
        '',
    };
  }
}

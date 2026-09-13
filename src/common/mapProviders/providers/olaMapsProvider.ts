import axios, { AxiosInstance } from 'axios';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { MapsProvider } from '../../enums/address.enum';
import { Helpers } from '../../helpers/common.helpers';

export class OlaMapsProvider {
  private readonly baseUrl = 'https://api.olamaps.io';
  private readonly tokenUrl =
    'https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token';
  private readonly timeout = 5000;
  private accessToken: string | null = null;
  private axiosInstance: AxiosInstance;

  constructor(
    private readonly clientId: string = process.env.OLA_MAPS_CLIENT_ID ?? '',
    private readonly clientSecret: string = process.env.OLA_MAPS_CLIENT_SECRET ?? '',
    private readonly apiKey: string = process.env.OLA_MAPS_API_KEY ?? '',
  ) {
    // this.validateCredentials();
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: { Accept: 'application/json' },
    });
  }

  private validateCredentials(): void {
    if (!this.clientId || !this.clientSecret || !this.apiKey) {
      throw new BadRequestException(
        'Missing required environment variables for OLA Maps API',
      );
    }
  }

  private async generateToken(): Promise<void> {
    const data = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'openid',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const response = await axios.post(this.tokenUrl, data.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.timeout,
      });

      this.accessToken = response.data.access_token;
    } catch (error) {
      console.error('Error fetching token:', error.message || error);
      throw new BadRequestException('Failed to generate token');
    }
  }

  private async makeAuthorizedRequest(config: any): Promise<any> {
    try {
      return await this.axiosInstance.request(config);
    } catch (err) {
      if (err.response?.status === HttpStatus.UNAUTHORIZED) {
        if (!this.accessToken) {
          await this.generateToken();
        }
        config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        return await this.axiosInstance.request(config);
      }
      throw err;
    }
  }

  public async placeAutocomplete(input: string): Promise<any> {
    const config = {
      method: 'get',
      url: '/places/v1/autocomplete',
      params: { input, api_key: this.apiKey },
    };

    const response = await this.makeAuthorizedRequest(config);
    return response.data;
  }

  public async reverseGeoCode(lat: number, long: number): Promise<any> {
    const config = {
      method: 'get',
      url: '/places/v1/reverse-geocode',
      params: { latlng: `${lat},${long}`, api_key: this.apiKey },
    };

    const response = await this.makeAuthorizedRequest(config);

    if (response.data) {
      return {
        ...this.buildAddress(response.data),
        ...response.data,
        provider: MapsProvider.OLA,
      };
    }

    throw new BadRequestException('No data returned from OLA Maps API.');
  }

  public async forwardGeoCode(
    address: string,
    language: string = 'English',
  ): Promise<any> {
    const config = {
      method: 'get',
      url: '/places/v1/geocode',
      params: { address, language, api_key: this.apiKey },
    };

    const response = await this.makeAuthorizedRequest(config);

    return {
      ...this.buildAddress(response.data),
      ...response.data,
      provider: MapsProvider.OLA,
    };
  }

  public async directions(
    fromLat: number,
    fromLong: number,
    toLat: number,
    toLong: number,
  ): Promise<any> {
    const config = {
      method: 'get',
      url: '/routing/v1/directions',
      params: {
        origin: `${fromLat},${fromLong}`,
        destination: `${toLat},${toLong}`,
        api_key: this.apiKey,
      },
    };

    const response = await this.makeAuthorizedRequest(config);
    return response.data;
  }

  public async placeDetails(placeId: string): Promise<any> {
    const config = {
      method: 'get',
      url: '/places/v1/details',
      params: { place_id: placeId, api_key: this.apiKey },
    };

    const response = await this.makeAuthorizedRequest(config);
    return response.data;
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

    return {
      address,
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

import { Injectable, Scope, Logger } from '@nestjs/common';
import { GoogleMapsProvider } from './providers/googleMapsProvider';
import { OlaMapsProvider } from './providers/olaMapsProvider';
import { PlaceAutocompleteResponse, PlaceDetailsResponseData } from '@googlemaps/google-maps-services-js';
import { MapServices, MapsProvider } from 'src/common/enums/address.enum';

@Injectable({ scope: Scope.DEFAULT })
export class MapProvidersService {
  private readonly logger = new Logger(MapProvidersService.name);

  constructor(
    private readonly gmapsProvider: GoogleMapsProvider,
    private readonly olaMapsProvider: OlaMapsProvider,
  ) { }

  private async getMapsProvider(service: string): Promise<MapsProvider> {
    const OLA_SERVICES = {
      [MapServices.DIRECTIONS]: MapsProvider.OLA,
      [MapServices.REVERSE_GEOCODING]: MapsProvider.OLA,
      [MapServices.FORWARD_GEOCODING]: MapsProvider.OLA,
      [MapServices.AUTO_COMPLETE]: MapsProvider.OLA,
    };
    if (service in OLA_SERVICES) {
      return OLA_SERVICES[service];
    }
    const envMapping = {
      [MapServices.REVERSE_GEOCODING]: 'REVERSE_GEOCODING_PROVIDER',
      [MapServices.DIRECTIONS]: 'DIRECTIONS_PROVIDER',
      [MapServices.FORWARD_GEOCODING]: 'FORWARD_GEOCODING_PROVIDER',
      [MapServices.AUTO_COMPLETE]: 'AUTO_COMPLETE_PROVIDER',
    };
    return (process.env[envMapping[service]] as MapsProvider) || MapsProvider.GOOGLE;
  }

  private getProviderMethod(provider: string, methodName: string) {
    switch (provider?.toUpperCase()) {
      case MapsProvider.OLA:
        return this.olaMapsProvider[methodName].bind(this.olaMapsProvider);
      case MapsProvider.GOOGLE:
      default:
        return this.gmapsProvider[methodName].bind(this.gmapsProvider);
    }
  }

  private async executeWithFallback<T>(primaryMethod: () => Promise<T>, fallbackMethod: () => Promise<T>): Promise<T> {
    try {
      return await primaryMethod();
    } catch (error) {
      this.logger.warn(`Primary method failed, using fallback. Error: ${error.message}`);
      return fallbackMethod();
    }
  }

  async reverseGeoCode(lat: number, long: number) {
    const provider = await this.getMapsProvider(MapServices.REVERSE_GEOCODING);
    return this.executeWithFallback(
      () => this.getProviderMethod(provider, 'reverseGeoCode')(lat, long),
      () => this.gmapsProvider.reverseGeoCode(lat, long)
    );
  }

  buildAddress(reverseGeoCodedAddress: any) {
    const provider = reverseGeoCodedAddress?.provider?.toUpperCase();
    return this.getProviderMethod(provider, 'buildAddress')(reverseGeoCodedAddress);
  }

  async directions(fromLat: number, fromLong: number, toLat: number, toLong: number) {
    const provider = await this.getMapsProvider(MapServices.DIRECTIONS);
    const result = await this.executeWithFallback(
      () => this.getProviderMethod(provider, 'directions')(fromLat, fromLong, toLat, toLong),
      () => this.gmapsProvider.directions(fromLat, fromLong, toLat, toLong)
    );

    if (provider === MapsProvider.OLA) {
      const route = result?.['routes']?.[0]?.legs?.[0];
      return {
        ...result,
        distance: route?.distance,
        duration: Math.round((route?.duration ?? 0) / 60),
        provider: MapsProvider.OLA
      };
    }
    return { ...result, provider: MapsProvider.GOOGLE };
  }

  async forwardGeoCode(query: string, placeId?: string) {
    const provider = await this.getMapsProvider(MapServices.FORWARD_GEOCODING);
    return this.executeWithFallback(
      () => this.getProviderMethod(provider, 'forwardGeoCode')(query, placeId),
      () => this.gmapsProvider.forwardGeoCode(query, placeId)
    );
  }

  async placeAutocomplete(params: string): Promise<PlaceAutocompleteResponse> {
    const provider = await this.getMapsProvider(MapServices.AUTO_COMPLETE);
    return this.executeWithFallback(
      () => this.getProviderMethod(provider, 'placeAutocomplete')(params),
      () => this.gmapsProvider.placeAutocomplete(params)
    );
  }

  async placeDetails(params: string): Promise<any> {
    if (params.startsWith('ola-platform')) {
      return this.olaMapsProvider.placeDetails(params);
    }
    return this.gmapsProvider.placeDetails(params);
  }
}
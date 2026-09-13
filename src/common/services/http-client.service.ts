import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class HttpClientService {
    constructor(private readonly httpService: HttpService) {}

    async get(serviceName: string, path: string, headers: Record<string, string> = {}): Promise<any> {
        try {
            const baseUrl = this.getServiceBaseUrl(serviceName);
            const response$ = this.httpService.get(`${baseUrl}${path}`, { headers });
            const response = await lastValueFrom(response$);
            return response.data;
        } catch (error) {
            throw new HttpException(
                `Failed to make GET request to ${serviceName}: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    async post(serviceName: string, path: string, data: any, headers: Record<string, string> = {}): Promise<any> {
        try {
            const baseUrl = this.getServiceBaseUrl(serviceName);
            const response$ = this.httpService.post(`${baseUrl}${path}`, data, { headers });
            const response = await lastValueFrom(response$);
            return response.data;
        } catch (error) {
            throw new HttpException(
                `Failed to make POST request to ${serviceName}: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    private getServiceBaseUrl(serviceName: string): string {
        const serviceUrls: Record<string, string> = {
            'MENU_SERVICE': process.env.MENU_SERVICE_URL || 'http://localhost:3001',
            // Add other service URLs here
        };

        const baseUrl = serviceUrls[serviceName];
        if (!baseUrl) {
            throw new HttpException(
                `Service URL not configured for ${serviceName}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }

        return baseUrl;
    }
} 
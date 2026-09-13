import { Injectable, Inject, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request } from 'express';
import { lastValueFrom } from 'rxjs';
import { ErrorException } from '../errors/custom-error.exception';
import { HTTP_HEADERS } from '../constants/http-headers.constants';
import { getBaseUrl } from '../constants/url-mapping.constants';
import { LoginMiddlewareExcludedApiRoutes } from '../enums/common.enum';
import { UserTypeEnum } from '../enums/user.enum';
import { Helpers } from '../helpers/common.helpers';

@Injectable()
export class HttpClientService {
  private baseUrls = getBaseUrl();
  constructor(
    private readonly httpService: HttpService,
    @Inject('REQUEST') private readonly req: Request,
  ) { }

  private getHeaders() {
    const headers = this.req['headers'];
    const interServiceHeaders = {
      [HTTP_HEADERS.ACCESS_TOKEN]: headers[HTTP_HEADERS.ACCESS_TOKEN],
      [HTTP_HEADERS.ID_TOKEN]: headers[HTTP_HEADERS.ID_TOKEN],
      [HTTP_HEADERS.USER_CURRENT_VIEW]: headers[HTTP_HEADERS.USER_CURRENT_VIEW],
      'origin': headers['origin'] || ''
    }
    if (Helpers.enumToArray(LoginMiddlewareExcludedApiRoutes).some((route) => this.req.path.includes(route as string))) {
      // interServiceHeaders[HTTP_HEADERS.USER_CURRENT_VIEW] = UserTypeEnum.CRON
    }
    return interServiceHeaders
  }

  private handleError(error: any) {
    console.log(error)
    if (error.response) {
      const { status = 500, data = {} } = error.response;
      const message = data.message || 'An unexpected error occurred';
      const errorCode = data.errorCode || 'ERR404';
      throw new ErrorException(errorCode, message, status);
    } else {
      throw new ErrorException(
        '',
        'No response received from the server',
        500,
      );
    }
  }

  private resolveUrl(serviceKey: string): string {
    const url = this.baseUrls[serviceKey];
    if (!url) {
      throw new ErrorException('', `Unknown service key: ${serviceKey}`, 500);
    }
    return url;
  }

  private buildUrl(serviceKey: string, endpoint?: string): string {
    const baseUrl = this.resolveUrl(serviceKey);
    return endpoint ? `${baseUrl}${endpoint}` : baseUrl;
  }

  public async get<T>(
    serviceKey: string,
    endpoint?: string,
    query?: any,
    skipError: boolean = false,
    headers?: Record<string, string>,
  ): Promise<{ result: T }> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const headersVal = this.getHeaders();
          
      const response$ = this.httpService.get(url, {
        params: query,
        headers: { ...headersVal, ...headers },
      });
      const response = await lastValueFrom(response$);
    
      return response.data.data; // <-- Only one return path here
    } catch (error) {
      console.log(`hey error ${error}`);
      if (!skipError) {
        this.handleError(error); // Ensure handleError() doesn't send a response
      }
      // Just return a value without attempting to send another response
      return { result: null as T };
    }
    
  }

  async post<T>(
    serviceKey: string,
    endpoint?: string,
    body?: any,
    query?: any,
  ): Promise<{ result: T } | undefined> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.post(url, body, {
        params: query,
        headers: this.getHeaders(),
      });
      // console.log("Headers: ", this.getHeaders())
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  async put<T>(
    serviceKey: string,
    endpoint?: string,
    body?: any,
  ): Promise<{ result: T } | undefined> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.put(url, body, {
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  async patch<T>(
    serviceKey: string,
    endpoint?: string,
    body?: any,
  ): Promise<{ result: T } | undefined> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.patch(url, body, {
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  async delete<T>(
    serviceKey: string,
    endpoint?: string,
    query?: any,
  ): Promise<{ result: T } | undefined> {
    try {
      const url = this.buildUrl(serviceKey, endpoint);
      const response$ = this.httpService.delete(url, {
        params: query,
        headers: this.getHeaders(),
      });
      const response = await lastValueFrom(response$);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }
}

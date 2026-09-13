import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HttpClientService } from '../inter-service-communication/http-client.service';
import { superAdminAllowedOrigins } from '../constants/service-common.constants';

@Injectable()
export class ClientIdMiddleware implements NestMiddleware {
  constructor(
    private readonly httpClientService: HttpClientService,
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    const USER_CURRENT_VIEW = req.headers['x-razorpay-signature'] || req.headers['stripe-signature']
    if (USER_CURRENT_VIEW) {
      next();
    }
    else {
      const restaurantIdQuery = req.query.restaurantId as string;

      if (restaurantIdQuery) {
        req['clientId'] = restaurantIdQuery;
        next();
        return;
      }

      const bypassPaths = [
        '/admin-auth/login',
        '/auth/leads/signup',
        '/auth/verify-lead-otp',
        '/auth/regenerate-lead-otp'
      ];
      const isBypassPath = bypassPaths.some(path => req.originalUrl.includes(path));

      if (!origin) {
        if (isBypassPath) {
          next();
          return;
        }
        throw new ForbiddenException('Origin header is required');
      }


      try {
        if (superAdminAllowedOrigins.includes(origin)) {
          req['clientId'] = req?.body?.restaurantId || 'super-admin';
          next();
        } else {
          const restaurantOriginUrl: string = origin;
          if (!restaurantOriginUrl) {
            throw new ForbiddenException('Invalid origin format');
          }

          // Fetch the restaurant details for this origin
          const restaurant: any = await this.httpClientService.get('MENU_SERVICE', `/restaurant/restaurant-by-url`);

          if (!restaurant) {
            if (isBypassPath) {
              next();
              return;
            }
            throw new ForbiddenException(`Unable to fetch tenantId details for ${restaurantOriginUrl}`);
          }

          // Ensure we only ever store a string id in clientId
          const clientId = restaurant.restaurantId || restaurant || restaurant.id;

          // Set the clientId in the request context
          req['clientId'] = clientId;
          next();
        }
      } catch (error) {
        if (isBypassPath) {
          next();
          return;
        }
        if ((['http://localhost:3004', 'https://console.zervfoods.com', 'https://console.dev.zervfoods.in'].includes(origin))) {
          next();
          return;
        }
        if (error instanceof ForbiddenException) {
          throw error;
        }
        throw new ForbiddenException('failed to fetch tenantId details' + error.message);
      }
    }
  }
}
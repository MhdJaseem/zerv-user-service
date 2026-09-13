import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Validates server-to-server calls using IDINE_INBOUND_SECRET
 * (header X-Idine-Secret or X-Api-Key). Required when NODE_ENV is production.
 */
@Injectable()
export class IdineAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.configService.get<string>('NODE_ENV') === 'production';
    const secret = this.configService.get<string>('IDINE_INBOUND_SECRET');
    if (!required && !secret) {
      return true;
    }
    if (!secret) {
      throw new UnauthorizedException('IDINE_INBOUND_SECRET is not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const header =
      (req.headers['x-idine-secret'] as string | undefined) ||
      (req.headers['x-api-key'] as string | undefined);
    if (!header || header !== secret) {
      throw new UnauthorizedException('Invalid iDine inbound credentials');
    }
    return true;
  }
}

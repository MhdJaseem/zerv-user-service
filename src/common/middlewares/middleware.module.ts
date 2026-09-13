import { Module } from '@nestjs/common';
import { ClientIdMiddleware } from './clientId.middleware';

@Module({
  imports: [],
  providers: [ClientIdMiddleware],
  exports: [ClientIdMiddleware],
})
export class MiddlewareModule {} 
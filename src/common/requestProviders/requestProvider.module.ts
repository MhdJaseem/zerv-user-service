import { Module } from '@nestjs/common';
import { RequestProvider } from './requestProviders';

@Module({
  providers: [RequestProvider],
  exports: [RequestProvider],
})
export class RequestProviderModule {}

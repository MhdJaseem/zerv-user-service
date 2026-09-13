import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        return next
            .handle()
            .pipe(
                map((value: APIResponse) => ({
                    statusCode: response.statusCode,
                    timestamp: new Date().toISOString(),
                    method: request.method,
                    path: request.url,
                    message: value?.message || "Success",
                    data: value?.result || {},
                })),
            );
    }
}

export interface APIResponse {
    result: any;
    message?: string;
}
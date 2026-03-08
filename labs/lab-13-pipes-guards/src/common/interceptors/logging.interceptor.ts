import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // TODO: Implement intercept
  // It should:
  // 1. Get the request from context: context.switchToHttp().getRequest()
  // 2. Log the method and URL: `${method} ${url}`
  // 3. Record the start time: Date.now()
  // 4. Call next.handle() and pipe tap() to log the duration after response
  // Hint:
  // const now = Date.now();
  // return next.handle().pipe(
  //   tap(() => console.log(`${method} ${url} - ${Date.now() - now}ms`)),
  // );
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    throw new Error('TODO: Not implemented');
  }
}

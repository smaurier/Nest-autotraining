import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  // TODO: Implement intercept
  // It should wrap the response data in a { data: ... } object
  // Hint:
  // return next.handle().pipe(
  //   map(data => ({ data })),
  // );
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    throw new Error('TODO: Not implemented');
  }
}

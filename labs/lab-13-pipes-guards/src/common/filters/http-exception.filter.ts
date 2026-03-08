import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  // TODO: Implement catch
  // It should:
  // 1. Get the HTTP response and request from the host
  //    Hint: host.switchToHttp().getResponse<Response>()
  //    Hint: host.switchToHttp().getRequest<Request>()
  // 2. Get the status code from the exception: exception.getStatus()
  // 3. Send a JSON response with format:
  //    { statusCode, timestamp, path, message }
  // Hint:
  // response.status(status).json({
  //   statusCode: status,
  //   timestamp: new Date().toISOString(),
  //   path: request.url,
  //   message: exception.message,
  // });
  catch(exception: HttpException, host: ArgumentsHost) {
    throw new Error('TODO: Not implemented');
  }
}

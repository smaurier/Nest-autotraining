import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  // TODO: Implement canActivate
  // It should:
  // 1. Get the request from the execution context
  //    Hint: const request = context.switchToHttp().getRequest();
  // 2. Check if the Authorization header exists and starts with 'Bearer '
  // 3. If no valid token, throw an UnauthorizedException
  // 4. Extract the token and simulate user extraction:
  //    - If token === 'admin-token', set request.user = { role: 'admin' }
  //    - If token === 'user-token', set request.user = { role: 'user' }
  //    - Otherwise throw UnauthorizedException
  // 5. Return true if authenticated
  canActivate(context: ExecutionContext): boolean {
    throw new Error('TODO: Not implemented');
  }
}

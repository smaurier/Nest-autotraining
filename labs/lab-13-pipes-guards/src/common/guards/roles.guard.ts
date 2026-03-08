import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  // TODO: Implement canActivate
  // It should:
  // 1. Get the required roles from the handler metadata using Reflector
  //    Hint: this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
  //      context.getHandler(), context.getClass()
  //    ]);
  // 2. If no roles are required, return true
  // 3. Get the user from request (set by AuthGuard): request.user
  // 4. Check if the user's role is included in the required roles
  // 5. If not, throw a ForbiddenException
  // 6. Return true if authorized
  canActivate(context: ExecutionContext): boolean {
    throw new Error('TODO: Not implemented');
  }
}

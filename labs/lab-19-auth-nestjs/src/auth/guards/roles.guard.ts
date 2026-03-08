import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  // TODO: Implement the canActivate method
  // It should:
  // 1. Get the required roles from the handler metadata using this.reflector.getAllAndOverride
  //    Hint: this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()])
  // 2. If no roles are required, return true (allow access)
  // 3. Get the user from the request object
  //    Hint: const { user } = context.switchToHttp().getRequest()
  // 4. Check if the user has at least one of the required roles
  //    Hint: return requiredRoles.some(role => user.roles?.includes(role))
  canActivate(context: ExecutionContext): boolean {
    throw new Error('TODO: Not implemented');
  }
}

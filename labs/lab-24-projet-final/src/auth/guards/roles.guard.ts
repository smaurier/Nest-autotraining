import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// TODO: Implement the RolesGuard
//   - Inject Reflector via constructor
//   - In canActivate(context: ExecutionContext):
//     1. Get required roles from metadata: this.reflector.get<string[]>('roles', context.getHandler())
//     2. If no roles required, return true
//     3. Get user from request: context.switchToHttp().getRequest().user
//     4. Return requiredRoles.includes(user.role)

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // TODO: implement
    return true;
  }
}

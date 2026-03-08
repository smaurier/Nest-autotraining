import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    if (token === 'admin-token') {
      request.user = { role: 'admin' };
    } else if (token === 'user-token') {
      request.user = { role: 'user' };
    } else {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }
}

import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

// TODO: Implement LocalStrategy
//   - Extend PassportStrategy(Strategy)
//   - In constructor: call super({ usernameField: 'email' }) and inject AuthService
//   - Implement async validate(email: string, password: string):
//     1. Call this.authService.validateUser(email, password)
//     2. If null, throw new UnauthorizedException()
//     3. Return the user

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    // TODO: implement validation
    return null;
  }
}

import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

// TODO: Implement the LocalStrategy
// It should:
// 1. Extend PassportStrategy(Strategy) — Strategy is from 'passport-local'
// 2. Call super() in the constructor (default fields are 'username' and 'password')
// 3. Inject the AuthService
// 4. Implement validate(username, password):
//    - Call this.authService.validateUser(username, password)
//    - If null is returned, throw UnauthorizedException
//    - Otherwise return the user
//
// Hint:
//   async validate(username: string, password: string): Promise<any> {
//     const user = await this.authService.validateUser(username, password);
//     if (!user) throw new UnauthorizedException();
//     return user;
//   }

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<any> {
    throw new Error('TODO: Not implemented');
  }
}

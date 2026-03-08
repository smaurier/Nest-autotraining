import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

// TODO: Implement the JwtStrategy
// It should:
// 1. Extend PassportStrategy(Strategy) — Strategy is from 'passport-jwt'
// 2. In the constructor, call super() with options:
//    - jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
//    - ignoreExpiration: false
//    - secretOrKey: 'nestjs-jwt-secret' (same secret used in JwtModule)
// 3. Implement validate(payload):
//    - The payload contains { sub, username, roles } (set during login)
//    - Return an object: { id: payload.sub, username: payload.username, roles: payload.roles }
//    - This object will be attached to request.user by Passport
//
// Hint:
//   async validate(payload: any) {
//     return { id: payload.sub, username: payload.username, roles: payload.roles };
//   }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'nestjs-jwt-secret',
    });
  }

  async validate(payload: any) {
    throw new Error('TODO: Not implemented');
  }
}

import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// TODO: Implement JwtStrategy
//   - Extend PassportStrategy(Strategy)
//   - In constructor: inject ConfigService, call super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
//     })
//   - Implement async validate(payload: any):
//     Return { id: payload.sub, email: payload.email, role: payload.role }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
    });
  }

  async validate(payload: any) {
    // TODO: return user object from JWT payload
    return null;
  }
}

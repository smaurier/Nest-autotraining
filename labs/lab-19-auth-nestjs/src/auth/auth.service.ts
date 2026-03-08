import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // TODO: Implement register(dto)
  // It should:
  // 1. Check if user already exists using usersService.findByUsername
  //    If exists, throw ConflictException('Username already exists')
  // 2. Hash the password using bcrypt.hashSync(dto.password, 10)
  // 3. Create the user with usersService.create({ username, password: hashed, roles })
  //    Default roles to ['user'] if not provided
  // 4. Return the user WITHOUT the password
  //    Hint: const { password, ...result } = user; return result;
  async register(dto: RegisterDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement validateUser(username, password)
  // It should:
  // 1. Find the user by username using usersService.findByUsername
  // 2. If not found, return null
  // 3. Compare the password with bcrypt.compareSync(password, user.password)
  // 4. If password matches, return the user WITHOUT the password
  // 5. If password doesn't match, return null
  async validateUser(username: string, password: string): Promise<any> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement login(user)
  // It should:
  // 1. Create a JWT payload: { sub: user.id, username: user.username, roles: user.roles }
  // 2. Generate an access token: this.jwtService.sign(payload)
  // 3. Generate a refresh token: this.jwtService.sign(payload, { expiresIn: '7d' })
  // 4. Return { access_token, refresh_token, user: { id, username, roles } }
  async login(user: any) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement refreshToken(token)
  // It should:
  // 1. Verify the refresh token: this.jwtService.verify(token)
  //    Wrap in try/catch — if invalid, throw UnauthorizedException('Invalid refresh token')
  // 2. Find the user by id using usersService.findById(payload.sub)
  // 3. If not found, throw UnauthorizedException
  // 4. Generate new tokens (call this.login with the user)
  // 5. Return the new tokens
  async refreshToken(token: string) {
    throw new Error('TODO: Not implemented');
  }
}

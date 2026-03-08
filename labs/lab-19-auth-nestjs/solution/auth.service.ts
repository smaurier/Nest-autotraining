import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../src/users/users.service';
import { RegisterDto } from '../src/auth/dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = this.usersService.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = bcrypt.hashSync(dto.password, 10);
    const user = this.usersService.create({
      username: dto.username,
      password: hashedPassword,
      roles: dto.roles || ['user'],
    });

    const { password, ...result } = user;
    return result;
  }

  async validateUser(username: string, password: string): Promise<any> {
    const user = this.usersService.findByUsername(username);
    if (!user) {
      return null;
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return null;
    }

    const { password: pwd, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { sub: user.id, username: user.username, roles: user.roles };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        username: user.username,
        roles: user.roles,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}

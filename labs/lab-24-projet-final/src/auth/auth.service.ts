import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// TODO: Inject UsersService and JwtService via constructor

// TODO: async register(dto: RegisterDto)
//   1. Check if user exists: this.usersService.findByEmail(dto.email)
//   2. If exists, throw new ConflictException('Email already registered')
//   3. Hash password: await bcrypt.hash(dto.password, 10)
//   4. Create user: this.usersService.create({ ...dto, password: hashedPassword })
//   5. Return { id: user.id, email: user.email, name: user.name }

// TODO: async validateUser(email: string, password: string)
//   1. Find user: this.usersService.findByEmail(email)
//   2. If not found, return null
//   3. Compare passwords: await bcrypt.compare(password, user.password)
//   4. If match, return user (without password). If not, return null

// TODO: async login(dto: LoginDto)
//   1. Validate user: await this.validateUser(dto.email, dto.password)
//   2. If not valid, throw new UnauthorizedException('Invalid credentials')
//   3. Create JWT payload: { sub: user.id, email: user.email, role: user.role }
//   4. Return { access_token: this.jwtService.sign(payload) }

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // TODO: implement methods
}

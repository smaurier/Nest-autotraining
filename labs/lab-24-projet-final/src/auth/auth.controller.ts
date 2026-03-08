import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// TODO: Decorate with @ApiTags('auth') and @Controller('auth')

// TODO: POST /auth/register — register a new user
//   @Post('register')
//   register(@Body() dto: RegisterDto)
//   Return this.authService.register(dto)

// TODO: POST /auth/login — login and get JWT token
//   @Post('login')
//   login(@Body() dto: LoginDto)
//   Return this.authService.login(dto)

// TODO: GET /auth/profile — get current user profile (protected)
//   @UseGuards(JwtAuthGuard)
//   @ApiBearerAuth()
//   @Get('profile')
//   getProfile(@Request() req)
//   Return req.user

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // TODO: implement endpoints
}

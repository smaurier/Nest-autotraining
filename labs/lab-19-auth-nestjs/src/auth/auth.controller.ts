import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // TODO: Implement POST /auth/register
  // It should call this.authService.register(dto) and return the result
  // Hint: Use @Post('register') and @Body() registerDto: RegisterDto
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /auth/login
  // It should:
  // 1. Use @UseGuards(LocalAuthGuard) to trigger Passport local strategy
  // 2. The user is attached to req.user after validation
  // 3. Call this.authService.login(req.user) and return the tokens
  // Hint: @UseGuards(LocalAuthGuard) @Post('login') login(@Request() req) { ... }
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /auth/profile
  // It should:
  // 1. Use @UseGuards(JwtAuthGuard) to protect the route
  // 2. Return req.user (the authenticated user)
  // Hint: @UseGuards(JwtAuthGuard) @Get('profile') getProfile(@Request() req) { return req.user; }
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /auth/refresh
  // It should:
  // 1. Accept { refresh_token } in the body
  // 2. Call this.authService.refreshToken(body.refresh_token)
  // 3. Return the new tokens
  @Post('refresh')
  refresh(@Body() body: { refresh_token: string }) {
    throw new Error('TODO: Not implemented');
  }
}

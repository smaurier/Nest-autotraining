import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// TODO: Implement the CurrentUser decorator
// It should extract the user from the request object
// Hint: Use createParamDecorator and access the request via ctx.switchToHttp().getRequest()
// The user is attached to the request by Passport after authentication
// If data is provided (e.g., @CurrentUser('username')), return only that property
// Otherwise return the full user object
//
// Example usage:
//   @Get('profile')
//   @UseGuards(JwtAuthGuard)
//   getProfile(@CurrentUser() user) { return user; }
//
//   @Get('name')
//   @UseGuards(JwtAuthGuard)
//   getName(@CurrentUser('username') username: string) { return username; }

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    throw new Error('TODO: Not implemented');
  },
);

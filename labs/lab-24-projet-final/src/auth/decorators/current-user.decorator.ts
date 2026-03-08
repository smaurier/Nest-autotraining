import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// TODO: Implement the CurrentUser decorator
//   Use createParamDecorator to extract the user from the request
//   const request = ctx.switchToHttp().getRequest();
//   return request.user;

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // TODO: implement — extract user from request
    return null;
  },
);

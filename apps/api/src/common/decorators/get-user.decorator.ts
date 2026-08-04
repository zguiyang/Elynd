import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { AuthUser } from '@elynd/auth/server';

export const GetUser = createParamDecorator((key: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  const user = request.user;

  if (!user) {
    return null;
  }

  if (key) {
    return user[key];
  }

  return user;
});

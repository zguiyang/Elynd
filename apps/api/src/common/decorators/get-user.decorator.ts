import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'

import type { SessionUser } from '@elynd/shared/types'

export const GetUser = createParamDecorator(
  (key: keyof SessionUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: SessionUser }>()
    const user = request.user

    if (!user) {
      return null
    }

    if (key) {
      return user[key]
    }

    return user
  }
)

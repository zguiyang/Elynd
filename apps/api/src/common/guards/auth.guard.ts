import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import type { Request } from 'express'

import { AuthApplicationService } from '../../auth/auth-application.service.js'
import { IS_PUBLIC_API } from '../decorators/public-api.decorator.js'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authApplicationService: AuthApplicationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_API, [
      context.getHandler(),
      context.getClass()
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const session = await this.authApplicationService.verifySession(request.headers)

    request['user'] = session.user
    return true
  }
}

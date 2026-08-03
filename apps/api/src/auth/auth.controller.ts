import { All, Controller, Req, Res } from '@nestjs/common'

import type { Request, Response } from 'express'

import { PublicAPI } from '../common/decorators/public-api.decorator.js'
import { AuthService } from './auth.service.js'

@Controller('auth')
@PublicAPI()
export class AuthController {
  constructor(private authService: AuthService) {}

  @All('/*path')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    return await this.authService.handler(req, res)
  }
}

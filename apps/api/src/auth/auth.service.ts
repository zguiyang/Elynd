import { Injectable } from '@nestjs/common'

import { toNodeHandler } from 'better-auth/node'

import { getAuthInstance } from '../core/auth.instance.js'

@Injectable()
export class AuthService {
  public readonly auth = getAuthInstance()

  public readonly handler = toNodeHandler(getAuthInstance().handler)
}

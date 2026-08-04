import { Injectable } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';

import { getAuthInstance } from '../core/auth.instance.js';

type AuthInstance = ReturnType<typeof getAuthInstance>;
type AuthHandler = ReturnType<typeof toNodeHandler>;

@Injectable()
export class AuthService {
  private authInstance: AuthInstance | null = null;
  private authHandler: AuthHandler | null = null;

  get auth(): AuthInstance {
    if (!this.authInstance) {
      this.authInstance = getAuthInstance();
    }
    return this.authInstance;
  }

  get handler(): AuthHandler {
    if (!this.authHandler) {
      this.authHandler = toNodeHandler(this.auth.handler);
    }
    return this.authHandler;
  }
}

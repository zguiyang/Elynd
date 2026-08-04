import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthClientPort, LoginInput, RegisterInput, SessionHeaders } from './auth-client.port.js';
import { AUTH_CLIENT } from './auth-client.port.js';

@Injectable()
export class AuthApplicationService {
  constructor(@Inject(AUTH_CLIENT) private readonly authClient: AuthClientPort) {}

  async register(input: RegisterInput) {
    const result = await this.authClient.signUpEmail(input);

    if (!result.ok) {
      if (result.code === 'DUPLICATE_EMAIL') {
        throw new ConflictException(result.message);
      }
      throw new BadRequestException(result.message);
    }

    return {
      user: result.user,
      session: result.session,
    };
  }

  async login(input: LoginInput) {
    const result = await this.authClient.signInEmail(input);

    if (!result.ok) {
      throw new UnauthorizedException(result.message);
    }

    return {
      user: result.user,
      session: result.session,
    };
  }

  async verifySession(headers: SessionHeaders) {
    const result = await this.authClient.getSession(headers);

    if (!result.ok) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return {
      user: result.user,
      session: result.session,
    };
  }
}

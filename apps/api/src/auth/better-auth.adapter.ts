import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { getAuthInstance } from '../core/auth.instance.js';
import type {
  AuthClientPort,
  AuthSession,
  AuthUser,
  GetSessionResult,
  LoginInput,
  RegisterInput,
  SessionHeaders,
  SignInResult,
  SignUpResult,
} from './auth-client.port.js';

function toAuthUser(user: { id: string; email: string; name: string }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

function toAuthSession(session: { id: string; userId: string; token: string }): AuthSession {
  return {
    id: session.id,
    userId: session.userId,
    token: session.token,
  };
}

@Injectable()
export class BetterAuthAdapter implements AuthClientPort {
  async signUpEmail(input: RegisterInput): Promise<SignUpResult> {
    try {
      // username plugin extends the runtime body; base BetterAuthOptions types omit it.
      const response = await getAuthInstance().api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
          username: input.username,
        } as {
          email: string;
          password: string;
          name: string;
          username: string;
        },
      });

      if (!response.user) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Registration failed',
        };
      }

      return {
        ok: true,
        user: toAuthUser(response.user),
        session: response.token
          ? {
              id: response.token,
              userId: response.user.id,
              token: response.token,
            }
          : null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';

      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exist')) {
        return {
          ok: false,
          code: 'DUPLICATE_EMAIL',
          message,
        };
      }

      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message,
      };
    }
  }

  async signInEmail(input: LoginInput): Promise<SignInResult> {
    try {
      const response = await getAuthInstance().api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
        },
      });

      if (!response.user || !response.token) {
        return {
          ok: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        };
      }

      return {
        ok: true,
        user: toAuthUser(response.user),
        session: {
          id: response.token,
          userId: response.user.id,
          token: response.token,
        },
      };
    } catch {
      return {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      };
    }
  }

  async getSession(headers: SessionHeaders): Promise<GetSessionResult> {
    const session = await getAuthInstance().api.getSession({
      headers: fromNodeHeaders(headers),
    });

    if (!session?.user || !session.session) {
      return { ok: false };
    }

    return {
      ok: true,
      user: toAuthUser(session.user),
      session: toAuthSession(session.session),
    };
  }
}

import { inject } from '@adonisjs/core';
import { Exception } from '@adonisjs/core/exceptions';
import type { HttpContext } from '@adonisjs/core/http';
import app from '@adonisjs/core/services/app';
import limiter from '@adonisjs/limiter/services/main';
import mail from '@adonisjs/mail/services/main';
import { SessionCollection } from '@adonisjs/session';
import { DateTime } from 'luxon';

import {
  AUTH_ERROR_EMAIL_NOT_VERIFIED,
  AUTH_ERROR_INVALID_EMAIL_TOKEN,
  AUTH_ERROR_INVALID_PASSWORD_TOKEN,
  AUTH_ERROR_USER_EXISTS,
} from '@elynd/shared/api/auth-errors';

import { normalizeEmail } from '#auth/policy';
import { applyUserCreateDefaults } from '#auth/user_create_defaults';
import PasswordResetNotification from '#mails/password_reset_notification';
import VerifyEmailNotification from '#mails/verify_email_notification';
import User from '#models/user';
import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  issueEmailVerificationToken,
  issuePasswordResetToken,
} from '#services/auth_tokens';
import MailCooldownService from '#services/mail_cooldown_service';
import env from '#start/env';

type RegisterInput = {
  email: string;
  username: string;
  password: string;
  fullName?: string | null;
};

type LoginInput = {
  login: string;
  password: string;
};

function userExistsException(): Exception {
  return new Exception('Email or username is already taken', {
    status: 409,
    code: AUTH_ERROR_USER_EXISTS,
  });
}

@inject()
export default class AuthService {
  constructor(protected cooldown: MailCooldownService) {}

  async register(input: RegisterInput): Promise<User> {
    const email = normalizeEmail(input.email);

    const existing = await User.query().where('email', email).orWhere('username', input.username).first();
    if (existing) {
      throw userExistsException();
    }

    await this.cooldown.tryAcquire('emailVerification', email);

    const defaults = applyUserCreateDefaults();

    let user: User;
    try {
      user = await User.create({
        email,
        username: input.username,
        password: input.password,
        fullName: input.fullName ?? null,
        role: defaults.role,
        image: defaults.image,
        emailVerifiedAt: null,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        throw userExistsException();
      }
      throw error;
    }

    await this.#sendVerificationEmail(user);
    return user;
  }

  async login(input: LoginInput, ctx: Pick<HttpContext, 'auth' | 'session' | 'request'>): Promise<User> {
    const uid = input.login.includes('@') ? normalizeEmail(input.login) : input.login;
    const loginLimiter = limiter.use({
      requests: 5,
      duration: '15 mins',
      blockDuration: '1 hour',
    });
    const [limitError, user] = await loginLimiter.penalize(`login_${ctx.request.ip()}_${uid}`, () =>
      User.verifyCredentials(uid, input.password),
    );
    if (limitError) {
      throw limitError;
    }

    if (!user.isEmailVerified) {
      throw new Exception('Email address is not verified', {
        status: 403,
        code: AUTH_ERROR_EMAIL_NOT_VERIFIED,
      });
    }

    await ctx.auth.use('web').login(user);
    if (ctx.session.supportsTagging()) {
      await ctx.session.tag(String(user.id));
    }
    return user;
  }

  async logout(ctx: Pick<HttpContext, 'auth'>): Promise<void> {
    const guard = ctx.auth.use('web');
    if (await guard.check()) {
      await guard.logout();
    }
  }

  async me(ctx: Pick<HttpContext, 'auth'>): Promise<User> {
    return ctx.auth.getUserOrFail() as User;
  }

  async verifyEmail(token: string): Promise<User> {
    const payload = await consumeEmailVerificationToken(token);
    const user = await User.find(payload.userId);
    if (!user) {
      throw new Exception('Invalid or expired email verification token', {
        status: 400,
        code: AUTH_ERROR_INVALID_EMAIL_TOKEN,
      });
    }

    if (normalizeEmail(user.email) !== normalizeEmail(payload.email)) {
      throw new Exception('Invalid or expired email verification token', {
        status: 400,
        code: AUTH_ERROR_INVALID_EMAIL_TOKEN,
      });
    }

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = DateTime.utc();
      await user.save();
    }

    await this.cooldown.clear('emailVerification', user.email);
    return user;
  }

  async resendVerification(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.cooldown.tryAcquire('emailVerification', email);

    const user = await User.findBy('email', email);
    if (user && !user.isEmailVerified) {
      await this.#sendVerificationEmail(user);
    }
  }

  async forgotPassword(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.cooldown.tryAcquire('passwordReset', email);

    const user = await User.findBy('email', email);
    if (user) {
      const token = await issuePasswordResetToken({ userId: user.id });
      const resetUrl = `${env.get('FRONTEND_URL')}/reset-password?token=${encodeURIComponent(token)}`;
      await mail.send(new PasswordResetNotification(user, resetUrl));
    }
  }

  async resetPassword(token: string, password: string): Promise<User> {
    const payload = await consumePasswordResetToken(token);
    const user = await User.find(payload.userId);
    if (!user) {
      throw new Exception('Invalid or expired password reset token', {
        status: 400,
        code: AUTH_ERROR_INVALID_PASSWORD_TOKEN,
      });
    }

    user.password = password;
    await user.save();

    await this.#destroyTaggedSessions(user.id);
    await this.cooldown.clear('passwordReset', user.email);
    return user;
  }

  async #destroyTaggedSessions(userId: number): Promise<void> {
    const sessionCollection = await app.container.make(SessionCollection);
    if (!sessionCollection.supportsTagging()) {
      return;
    }
    const sessions = await sessionCollection.tagged(String(userId));
    for (const entry of sessions) {
      await sessionCollection.destroy(entry.id);
    }
  }

  async #sendVerificationEmail(user: User) {
    const token = await issueEmailVerificationToken({
      userId: user.id,
      email: user.email,
    });
    const verifyUrl = `${env.get('FRONTEND_URL')}/verify-email?token=${encodeURIComponent(token)}`;
    await mail.send(new VerifyEmailNotification(user, verifyUrl));
  }
}

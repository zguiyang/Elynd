import { Inject, Injectable } from '@nestjs/common';
import { AfterHook, type AuthHookContext, BeforeHook, Hook } from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth/api';

import { AUTH_MAIL_COOLDOWN_ERROR_CODE, mailCooldownUserMessage } from '@elynd/auth/policy';

import type { MailCooldownPurpose } from './mail-cooldown.keys.js';
import { MailCooldownService } from './mail-cooldown.service.js';

function emailFromBody(ctx: AuthHookContext): string {
  const email = ctx.body?.email;
  return typeof email === 'string' ? email : '';
}

function isHookError(returned: unknown): boolean {
  return returned instanceof APIError;
}

@Hook()
@Injectable()
export class MailCooldownHook {
  constructor(@Inject(MailCooldownService) private readonly mailCooldown: MailCooldownService) {}

  @BeforeHook('/send-verification-email')
  async beforeSendVerification(ctx: AuthHookContext): Promise<void> {
    await this.assertNotCoolingDown(ctx, 'emailVerification');
  }

  @BeforeHook('/request-password-reset')
  async beforeRequestPasswordReset(ctx: AuthHookContext): Promise<void> {
    await this.assertNotCoolingDown(ctx, 'passwordReset');
  }

  @AfterHook('/send-verification-email')
  async afterSendVerification(ctx: AuthHookContext): Promise<void> {
    await this.markIfOk(ctx, 'emailVerification');
  }

  @AfterHook('/request-password-reset')
  async afterRequestPasswordReset(ctx: AuthHookContext): Promise<void> {
    await this.markIfOk(ctx, 'passwordReset');
  }

  @AfterHook('/sign-up/email')
  async afterSignUp(ctx: AuthHookContext): Promise<void> {
    await this.markIfOk(ctx, 'emailVerification');
  }

  @AfterHook('/verify-email')
  async afterVerifyEmail(ctx: AuthHookContext): Promise<void> {
    await this.clearIfOk(ctx, 'emailVerification');
  }

  @AfterHook('/reset-password')
  async afterResetPassword(ctx: AuthHookContext): Promise<void> {
    await this.clearIfOk(ctx, 'passwordReset');
  }

  private async assertNotCoolingDown(ctx: AuthHookContext, purpose: MailCooldownPurpose): Promise<void> {
    const email = emailFromBody(ctx);
    if (!email.trim()) {
      return;
    }
    if (await this.mailCooldown.isActive(purpose, email)) {
      throw new APIError('BAD_REQUEST', {
        message: mailCooldownUserMessage(purpose),
        code: AUTH_MAIL_COOLDOWN_ERROR_CODE,
      });
    }
  }

  private async markIfOk(ctx: AuthHookContext, purpose: MailCooldownPurpose): Promise<void> {
    if (isHookError(ctx.context.returned)) {
      return;
    }
    const email = emailFromBody(ctx);
    if (!email.trim()) {
      return;
    }
    await this.mailCooldown.markSent(purpose, email);
  }

  private async clearIfOk(ctx: AuthHookContext, purpose: MailCooldownPurpose): Promise<void> {
    if (isHookError(ctx.context.returned)) {
      return;
    }
    const email = emailFromBody(ctx);
    if (email.trim()) {
      await this.mailCooldown.clear(purpose, email);
      return;
    }
    const sessionEmail = ctx.context.newSession?.user?.email;
    if (typeof sessionEmail === 'string' && sessionEmail.trim()) {
      await this.mailCooldown.clear(purpose, sessionEmail);
    }
  }
}

import { Exception } from '@adonisjs/core/exceptions';
import redis from '@adonisjs/redis/services/main';

import {
  AUTH_MAIL_COOLDOWN_ERROR_CODE,
  type AuthMailCooldownPurpose,
  mailCooldownSeconds,
  mailCooldownUserMessage,
  normalizeEmail,
} from '#auth/policy';

export function mailCooldownKey(purpose: AuthMailCooldownPurpose, email: string): string {
  return `mail:cooldown:${purpose}:${normalizeEmail(email)}`;
}

export default class MailCooldownService {
  /**
   * Atomically acquire the cooldown window. Throws 429 when already cooling down.
   * Call for every forgot/resend attempt (including unknown emails) to avoid enumeration.
   */
  async tryAcquire(purpose: AuthMailCooldownPurpose, email: string): Promise<void> {
    const result = await redis.set(mailCooldownKey(purpose, email), '1', 'EX', mailCooldownSeconds(purpose), 'NX');
    if (result !== 'OK') {
      throw new Exception(mailCooldownUserMessage(purpose), {
        status: 429,
        code: AUTH_MAIL_COOLDOWN_ERROR_CODE,
      });
    }
  }

  async clear(purpose: AuthMailCooldownPurpose, email: string): Promise<void> {
    await redis.del(mailCooldownKey(purpose, email));
  }
}

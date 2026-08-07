import { Exception } from '@adonisjs/core/exceptions';
import redis from '@adonisjs/redis/services/main';
import {
  AUTH_MAIL_COOLDOWN_ERROR_CODE,
  mailCooldownSeconds,
  mailCooldownUserMessage,
  normalizeEmail,
  type AuthMailCooldownPurpose,
} from '#auth/policy';

export function mailCooldownKey(purpose: AuthMailCooldownPurpose, email: string): string {
  return `mail:cooldown:${purpose}:${normalizeEmail(email)}`;
}

export default class MailCooldownService {
  async isActive(purpose: AuthMailCooldownPurpose, email: string): Promise<boolean> {
    const count = await redis.exists(mailCooldownKey(purpose, email));
    return count > 0;
  }

  async assertAllowed(purpose: AuthMailCooldownPurpose, email: string): Promise<void> {
    if (await this.isActive(purpose, email)) {
      throw new Exception(mailCooldownUserMessage(purpose), {
        status: 429,
        code: AUTH_MAIL_COOLDOWN_ERROR_CODE,
      });
    }
  }

  async mark(purpose: AuthMailCooldownPurpose, email: string): Promise<void> {
    await redis.set(mailCooldownKey(purpose, email), '1', 'EX', mailCooldownSeconds(purpose));
  }

  async clear(purpose: AuthMailCooldownPurpose, email: string): Promise<void> {
    await redis.del(mailCooldownKey(purpose, email));
  }
}

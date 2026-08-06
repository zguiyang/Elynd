import { Inject, Injectable } from '@nestjs/common';

import { AUTH_MAIL_SEND_COOLDOWN_SECONDS } from '@elynd/auth/policy';

import { RedisService } from '../global/redis.service.js';
import { mailCooldownKey, type MailCooldownPurpose, normalizeMailCooldownEmail } from './mail-cooldown.keys.js';

@Injectable()
export class MailCooldownService {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async isActive(purpose: MailCooldownPurpose, email: string): Promise<boolean> {
    const normalized = normalizeMailCooldownEmail(email);
    if (!normalized) {
      return false;
    }
    const count = await this.redis.getClient().exists(mailCooldownKey(purpose, normalized));
    return count === 1;
  }

  async markSent(purpose: MailCooldownPurpose, email: string): Promise<void> {
    const normalized = normalizeMailCooldownEmail(email);
    if (!normalized) {
      return;
    }
    await this.redis.getClient().set(mailCooldownKey(purpose, normalized), '1', 'EX', AUTH_MAIL_SEND_COOLDOWN_SECONDS);
  }

  async clear(purpose: MailCooldownPurpose, email: string): Promise<void> {
    const normalized = normalizeMailCooldownEmail(email);
    if (!normalized) {
      return;
    }
    await this.redis.getClient().del(mailCooldownKey(purpose, normalized));
  }
}

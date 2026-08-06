import type { AuthMailCooldownPurpose } from '@elynd/auth/policy';

export type MailCooldownPurpose = AuthMailCooldownPurpose;

export function normalizeMailCooldownEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function mailCooldownKey(purpose: MailCooldownPurpose, email: string): string {
  return `mail:cooldown:${purpose}:${normalizeMailCooldownEmail(email)}`;
}

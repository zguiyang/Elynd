export type MailCooldownPurpose = 'emailVerification' | 'passwordReset';

export function normalizeMailCooldownEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function mailCooldownKey(purpose: MailCooldownPurpose, email: string): string {
  return `mail:cooldown:${purpose}:${normalizeMailCooldownEmail(email)}`;
}

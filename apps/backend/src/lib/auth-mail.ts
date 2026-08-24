import type { Env } from '@/lib/env';
import { env } from '@/lib/env';
import { authLogger } from '@/lib/logger';

export function buildVerificationUrl(token: string, frontendUrl: string = env.FRONTEND_URL): string {
  return `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

/** Dev-only: log auth links when Resend is not configured. */
export function shouldLogDevAuthLink(config: Pick<Env, 'NODE_ENV' | 'RESEND_API_KEY'> = env): boolean {
  return config.NODE_ENV === 'development' && !config.RESEND_API_KEY;
}

export function logDevAuthLink(input: { to: string; url: string; kind: 'verify-email' }): void {
  if (!shouldLogDevAuthLink()) {
    return;
  }
  authLogger.info(
    { to: input.to, url: input.url, kind: input.kind },
    'Dev auth link (RESEND_API_KEY unset; open in browser)',
  );
}

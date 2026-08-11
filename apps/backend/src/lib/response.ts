import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function sendError(c: Context, message: string, status: ContentfulStatusCode) {
  return c.json({ error: message }, status);
}

export function sendValidationError(c: Context, details: { path: string; message: string }[]) {
  return c.json({ error: 'Validation failed', details }, 400 as ContentfulStatusCode);
}

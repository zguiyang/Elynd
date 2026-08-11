import type { User } from '@elynd/shared/api/auth';

export type AuthError = {
  message: string;
  code?: string;
  status?: number;
};

/** Client-side request result (UX). Distinct from HTTP `{ data: T }` payloads. */
export type AuthResult<T> = { data: T; error: null } | { data: null; error: AuthError };

/** @deprecated Prefer `User` from `@elynd/shared/api/auth` — alias kept for gradual imports. */
export type AuthUser = User;

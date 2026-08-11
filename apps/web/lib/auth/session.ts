'use client';

import { type User, userSchema } from '@elynd/shared/api/auth';

import { logout as apiLogout } from './api';
import { baClient } from './ba-client';
import type { AuthError, AuthUser } from './types';

type SessionState = {
  data: { user: AuthUser } | null;
  error: AuthError | null;
  isPending: boolean;
  refresh: () => void;
};

function mapUser(raw: unknown): User | null {
  const parsed = userSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Soft session UX via BA `useSession` → backend get-session. */
export function useSession(): SessionState {
  const session = baClient.useSession();
  const user = session.data?.user ? mapUser(session.data.user) : null;

  let error: AuthError | null = null;
  if (session.error) {
    const err = session.error as { message?: string; code?: string; status?: number };
    error = {
      message: err.message || 'Session refresh failed',
      code: typeof err.code === 'string' ? err.code : undefined,
      status: err.status,
    };
  } else if (!session.isPending && !user) {
    error = { message: 'Unauthorized', status: 401 };
  }

  return {
    data: user ? { user } : null,
    error,
    isPending: session.isPending,
    refresh: () => {
      void session.refetch();
    },
  };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  return { error: (await apiLogout()).error };
}

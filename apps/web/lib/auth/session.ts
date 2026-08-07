'use client';

import { useCallback, useEffect, useState } from 'react';

import { logout as apiLogout, me } from './api';
import { clearAccessToken, getAccessToken } from './token';
import type { AuthError, AuthUser } from './types';

type SessionState = {
  data: { user: AuthUser } | null;
  error: AuthError | null;
  isPending: boolean;
};

function initialSessionState(): SessionState {
  if (typeof window === 'undefined') {
    return { data: null, error: null, isPending: true };
  }
  if (!getAccessToken()) {
    return { data: null, error: null, isPending: false };
  }
  return { data: null, error: null, isPending: true };
}

/**
 * Thin session hook backed by Bearer token + GET /api/auth/me.
 * Replaces Better Auth `useSession`.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>(initialSessionState);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ data: null, error: null, isPending: false });
      return;
    }

    setState((prev) => ({ ...prev, isPending: true }));
    const result = await me();
    if (result.error) {
      clearAccessToken();
      setState({ data: null, error: result.error, isPending: false });
      return;
    }
    setState({ data: { user: result.data }, error: null, isPending: false });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    if (!token) {
      return;
    }

    void (async () => {
      const result = await me();
      if (cancelled) {
        return;
      }
      if (result.error) {
        clearAccessToken();
        setState({ data: null, error: result.error, isPending: false });
        return;
      }
      setState({ data: { user: result.data }, error: null, isPending: false });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, refresh };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const result = await apiLogout();
  return { error: result.error };
}

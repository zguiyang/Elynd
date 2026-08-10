'use client';

import { useCallback, useEffect, useState } from 'react';

import { logout as apiLogout, me } from './api';
import type { AuthError, AuthUser } from './types';

type SessionState = {
  data: { user: AuthUser } | null;
  error: AuthError | null;
  isPending: boolean;
};

/** Soft session UX via /me. Real auth is Adonis middleware. */
export function useSession() {
  const [state, setState] = useState<SessionState>({
    data: null,
    error: null,
    isPending: true,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isPending: true }));
    try {
      const result = await me();
      if (result.error) {
        if (result.error.status === 401) {
          try {
            await apiLogout();
          } catch {
            // ignore logout transport errors on soft gate
          }
        }
        setState({ data: null, error: result.error, isPending: false });
        return;
      }
      setState({ data: { user: result.data }, error: null, isPending: false });
    } catch (error) {
      setState({
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Session refresh failed',
          status: 0,
        },
        isPending: false,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await me();
        if (cancelled) {
          return;
        }
        if (result.error) {
          if (result.error.status === 401) {
            try {
              await apiLogout();
            } catch {
              // ignore
            }
          }
          if (cancelled) {
            return;
          }
          setState({ data: null, error: result.error, isPending: false });
          return;
        }
        setState({ data: { user: result.data }, error: null, isPending: false });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setState({
          data: null,
          error: {
            message: error instanceof Error ? error.message : 'Session refresh failed',
            status: 0,
          },
          isPending: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, refresh };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  return { error: (await apiLogout()).error };
}

import type {
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResendVerificationBody,
  ResetPasswordBody,
  User,
} from '@elynd/shared/api/auth';
import type { ApiValidationError } from '@elynd/shared/api/envelope';

import type { AuthError, AuthResult } from './types';

const AUTH_API_PREFIX = '/api/auth';

async function parseError(response: Response): Promise<AuthError> {
  let body: ApiValidationError & { message?: string; code?: string } = { errors: [] };
  try {
    body = (await response.json()) as ApiValidationError & { message?: string; code?: string };
  } catch {
    // ignore
  }
  const fromErrors = body.errors
    ?.map((item) => item.message)
    .filter(Boolean)
    .join('; ');
  return {
    message: body.message?.trim() || fromErrors || response.statusText || 'Request failed',
    code: body.code,
    status: response.status,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<AuthResult<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${AUTH_API_PREFIX}${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    return { data: null, error: await parseError(response) };
  }

  if (response.status === 204) {
    return { data: null as T, error: null };
  }

  const json = (await response.json()) as { data: T } | T;
  const data = json && typeof json === 'object' && 'data' in json ? json.data : (json as T);
  return { data, error: null };
}

export async function register(input: RegisterBody): Promise<AuthResult<User>> {
  return request<User>('/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginBody): Promise<AuthResult<User>> {
  return request<User>('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<AuthResult<{ ok: boolean }>> {
  const result = await request<{ ok: boolean }>('/logout', { method: 'DELETE' });
  return result.data ? result : { data: { ok: true }, error: null };
}

export async function me(): Promise<AuthResult<User>> {
  return request<User>('/me');
}

export async function resendVerificationEmail(
  email: ResendVerificationBody['email'],
): Promise<AuthResult<{ ok: boolean }>> {
  return request<{ ok: boolean }>('/email/resend', {
    method: 'POST',
    body: JSON.stringify({ email } satisfies ResendVerificationBody),
  });
}

export async function verifyEmail(token: string): Promise<AuthResult<User>> {
  const qs = new URLSearchParams({ token });
  return request<User>(`/email/verify?${qs.toString()}`, {
    method: 'GET',
  });
}

export async function forgotPassword(email: ForgotPasswordBody['email']): Promise<AuthResult<{ ok: boolean }>> {
  return request<{ ok: boolean }>('/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email } satisfies ForgotPasswordBody),
  });
}

export async function resetPassword(input: ResetPasswordBody): Promise<AuthResult<User>> {
  return request<User>('/password/reset', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

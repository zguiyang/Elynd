import type { AuthError, AuthResult, AuthUser } from './types';

const AUTH_API_PREFIX = '/api/auth';

type ErrorBody = {
  message?: string;
  code?: string;
  errors?: Array<{ message?: string }>;
};

async function parseError(response: Response): Promise<AuthError> {
  let body: ErrorBody = {};
  try {
    body = (await response.json()) as ErrorBody;
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

export async function register(input: {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}): Promise<AuthResult<AuthUser>> {
  return request<AuthUser>('/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: { login: string; password: string }): Promise<AuthResult<AuthUser>> {
  return request<AuthUser>('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<AuthResult<{ ok: boolean }>> {
  const result = await request<{ ok: boolean }>('/logout', { method: 'DELETE' });
  return result.data ? result : { data: { ok: true }, error: null };
}

export async function me(): Promise<AuthResult<AuthUser>> {
  return request<AuthUser>('/me');
}

export async function resendVerificationEmail(email: string): Promise<AuthResult<{ ok: boolean }>> {
  return request<{ ok: boolean }>('/email/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(token: string): Promise<AuthResult<AuthUser>> {
  const qs = new URLSearchParams({ token });
  return request<AuthUser>(`/email/verify?${qs.toString()}`, {
    method: 'GET',
  });
}

export async function forgotPassword(email: string): Promise<AuthResult<{ ok: boolean }>> {
  return request<{ ok: boolean }>('/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(input: { token: string; password: string }): Promise<AuthResult<AuthUser>> {
  return request<AuthUser>('/password/reset', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

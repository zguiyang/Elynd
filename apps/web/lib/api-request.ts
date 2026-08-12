import type { z } from 'zod';

export type ApiRequestErrorInfo = {
  message: string;
  status: number;
  details?: { path: string; message: string }[];
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly details?: { path: string; message: string }[];

  constructor(error: ApiRequestErrorInfo) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.status = error.status;
    this.details = error.details;
  }
}

export type ApiRequestOptions<T> = {
  schema: z.ZodType<T>;
  method?: string;
  /** JSON body — sets Content-Type application/json unless overridden. */
  json?: unknown;
  /** Raw body (FormData, Blob, string, etc.). Prefer over `json` when set. */
  body?: BodyInit | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  onResponse?: (response: Response) => void;
  onError?: (error: ApiRequestError) => void;
};

async function readApiError(response: Response): Promise<ApiRequestErrorInfo> {
  let message = '请求失败';
  let details: ApiRequestErrorInfo['details'];
  try {
    const body = (await response.json()) as {
      error?: string;
      details?: { path: string; message: string }[];
    };
    if (body.error?.trim()) {
      message = body.error.trim();
    }
    if (Array.isArray(body.details)) {
      details = body.details;
    }
  } catch {
    // keep defaults
  }
  return { message, status: response.status, details };
}

function throwApiError(info: ApiRequestErrorInfo, onError?: (error: ApiRequestError) => void): never {
  const error = new ApiRequestError(info);
  onError?.(error);
  throw error;
}

/**
 * Thin fetch wrapper for same-origin business JSON APIs.
 * Works with TanStack Query via `queryFn: ({ signal }) => apiRequest(path, { schema, signal })`.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
  const { schema, json, onResponse, onError, headers: initHeaders, body: rawBody, ...rest } = options;

  const headers = new Headers(initHeaders);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  let body = rawBody;
  if (body === undefined && json !== undefined) {
    body = JSON.stringify(json);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  } else if (body != null && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...rest,
    body,
    credentials: options.credentials ?? 'same-origin',
    headers,
    signal: options.signal,
  });

  onResponse?.(response);

  if (!response.ok) {
    throwApiError(await readApiError(response), onError);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throwApiError({ message: '响应格式无效', status: 502 }, onError);
  }
  return parsed.data;
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.details?.length) {
      return error.details.map((d) => d.message).join('；');
    }
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return '请求失败，请稍后重试';
}

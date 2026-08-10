/** Stable auth API error codes (SSOT for backend Exception.code + web branching). */

export const AUTH_ERROR_EMAIL_NOT_VERIFIED = 'E_EMAIL_NOT_VERIFIED' as const;
export const AUTH_ERROR_USER_EXISTS = 'E_USER_EXISTS' as const;
export const AUTH_ERROR_INVALID_EMAIL_TOKEN = 'E_INVALID_EMAIL_TOKEN' as const;
export const AUTH_ERROR_INVALID_PASSWORD_TOKEN = 'E_INVALID_PASSWORD_TOKEN' as const;

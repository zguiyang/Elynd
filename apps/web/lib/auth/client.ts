import type { User } from '@elynd/shared/api/auth';

import * as api from './api';
import { signOut, useSession } from './session';

export type { AuthError, AuthResult, AuthUser } from './types';
export type { User };

/**
 * Auth façade: Adonis session cookies via same-origin `/api/auth/*`.
 */
export const authClient = {
  register: api.register,
  login: api.login,
  logout: api.logout,
  me: api.me,
  resendVerificationEmail: api.resendVerificationEmail,
  verifyEmail: api.verifyEmail,
  forgotPassword: api.forgotPassword,
  resetPassword: api.resetPassword,
  useSession,
  signOut,
};

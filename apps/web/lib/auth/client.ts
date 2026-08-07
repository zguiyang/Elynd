import * as api from './api';
import { signOut, useSession } from './session';

/**
 * Auth façade used by forms and shell.
 * Same-origin `/api/auth/*` (Next rewrite → Adonis).
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

import * as api from './api';
import { signOut, useSession } from './session';

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

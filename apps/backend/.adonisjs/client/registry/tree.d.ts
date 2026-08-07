/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    register: typeof routes['auth.register']
    login: typeof routes['auth.login']
    logout: typeof routes['auth.logout']
    me: typeof routes['auth.me']
    emailVerifyGet: typeof routes['auth.email_verify_get']
    emailVerifyPost: typeof routes['auth.email_verify_post']
    resendVerification: typeof routes['auth.resend_verification']
    forgotPassword: typeof routes['auth.forgot_password']
    resetPassword: typeof routes['auth.reset_password']
  }
}

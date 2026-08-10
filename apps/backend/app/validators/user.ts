import vine from '@vinejs/vine';

import type {
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResendVerificationBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from '@elynd/shared/api/auth';

import { AUTH_PASSWORD_POLICY, AUTH_USERNAME_POLICY } from '#auth/policy';

const usernameRule = vine
  .string()
  .trim()
  .minLength(AUTH_USERNAME_POLICY.minLength)
  .maxLength(AUTH_USERNAME_POLICY.maxLength)
  .regex(AUTH_USERNAME_POLICY.pattern);

const passwordRule = vine.string().minLength(AUTH_PASSWORD_POLICY.minLength).maxLength(AUTH_PASSWORD_POLICY.maxLength);

export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    username: usernameRule.clone(),
    password: passwordRule.clone(),
    fullName: vine.string().trim().maxLength(100).optional(),
  }),
);

export const loginValidator = vine.compile(
  vine.object({
    /** Email or username */
    login: vine.string().trim().minLength(1).maxLength(254),
    password: passwordRule.clone(),
  }),
);

export const resendVerificationValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
  }),
);

export const verifyEmailValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
  }),
);

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
  }),
);

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
    password: passwordRule.clone(),
  }),
);

/** Compile-time: Vine outputs must stay assignable to shared wire contracts. */
type Expect<T extends true> = T;

export type AuthValidatorWireAlign = {
  login: Expect<Awaited<ReturnType<typeof loginValidator.validate>> extends LoginBody ? true : false>;
  register: Expect<Awaited<ReturnType<typeof registerValidator.validate>> extends RegisterBody ? true : false>;
  forgot: Expect<
    Awaited<ReturnType<typeof forgotPasswordValidator.validate>> extends ForgotPasswordBody ? true : false
  >;
  reset: Expect<Awaited<ReturnType<typeof resetPasswordValidator.validate>> extends ResetPasswordBody ? true : false>;
  resend: Expect<
    Awaited<ReturnType<typeof resendVerificationValidator.validate>> extends ResendVerificationBody ? true : false
  >;
  verify: Expect<Awaited<ReturnType<typeof verifyEmailValidator.validate>> extends VerifyEmailBody ? true : false>;
};

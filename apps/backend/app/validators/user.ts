import vine from '@vinejs/vine'
import { AUTH_PASSWORD_POLICY, AUTH_USERNAME_POLICY } from '#auth/policy'

const usernameRule = vine
  .string()
  .trim()
  .minLength(AUTH_USERNAME_POLICY.minLength)
  .maxLength(AUTH_USERNAME_POLICY.maxLength)
  .regex(AUTH_USERNAME_POLICY.pattern)

const passwordRule = vine
  .string()
  .minLength(AUTH_PASSWORD_POLICY.minLength)
  .maxLength(AUTH_PASSWORD_POLICY.maxLength)

export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    username: usernameRule.clone(),
    password: passwordRule.clone(),
    fullName: vine.string().trim().maxLength(100).optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    /** Email or username */
    login: vine.string().trim().minLength(1).maxLength(254),
    password: passwordRule.clone(),
  })
)

export const resendVerificationValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
  })
)

export const verifyEmailValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
  })
)

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
    password: passwordRule.clone(),
  })
)

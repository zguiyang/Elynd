import { inject } from '@adonisjs/core';
import type { HttpContext } from '@adonisjs/core/http';
import { ApiBody, ApiOperation, ApiTags } from '@foadonis/openapi/decorators';

import AuthService from '#services/auth_service';
import UserTransformer from '#transformers/user_transformer';
import {
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resendVerificationValidator,
  resetPasswordValidator,
  verifyEmailValidator,
} from '#validators/user';

@inject()
@ApiTags('Auth')
export default class AuthController {
  constructor(protected authService: AuthService) {}

  /**
   * POST /api/auth/register
   */
  @ApiOperation({ summary: 'Register' })
  @ApiBody({ type: () => registerValidator })
  async register({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(registerValidator);
    const user = await this.authService.register(payload);
    return serialize(UserTransformer.transform(user));
  }

  /**
   * POST /api/auth/login — establishes `web` session cookie.
   */
  @ApiOperation({ summary: 'Login' })
  @ApiBody({ type: () => loginValidator })
  async login(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(loginValidator);
    const user = await this.authService.login(payload, ctx);
    return ctx.serialize(UserTransformer.transform(user));
  }

  /**
   * DELETE /api/auth/logout — idempotent; clears session even when already anonymous.
   */
  @ApiOperation({ summary: 'Logout' })
  async logout(ctx: HttpContext) {
    await this.authService.logout(ctx);
    return { ok: true };
  }

  /**
   * GET /api/auth/me
   */
  @ApiOperation({ summary: 'Current user' })
  async me(ctx: HttpContext) {
    const user = await this.authService.me(ctx);
    return ctx.serialize(UserTransformer.transform(user));
  }

  /**
   * GET|POST /api/auth/email/verify
   */
  @ApiOperation({ summary: 'Verify email' })
  @ApiBody({ type: () => verifyEmailValidator, required: false })
  async verifyEmail({ request, serialize }: HttpContext) {
    const queryToken = request.input('token');
    let token: string;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      token = queryToken;
    } else {
      const body = await request.validateUsing(verifyEmailValidator);
      token = body.token;
    }

    const user = await this.authService.verifyEmail(token);
    return serialize(UserTransformer.transform(user));
  }

  /**
   * POST /api/auth/email/resend
   */
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBody({ type: () => resendVerificationValidator })
  async resendVerification({ request }: HttpContext) {
    const { email } = await request.validateUsing(resendVerificationValidator);
    await this.authService.resendVerification(email);
    return { ok: true };
  }

  /**
   * POST /api/auth/password/forgot
   */
  @ApiOperation({ summary: 'Forgot password' })
  @ApiBody({ type: () => forgotPasswordValidator })
  async forgotPassword({ request }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator);
    await this.authService.forgotPassword(email);
    return { ok: true };
  }

  /**
   * POST /api/auth/password/reset
   */
  @ApiOperation({ summary: 'Reset password' })
  @ApiBody({ type: () => resetPasswordValidator })
  async resetPassword({ request, serialize }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator);
    const user = await this.authService.resetPassword(token, password);
    return serialize(UserTransformer.transform(user));
  }
}

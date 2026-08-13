'use client';

import { useForm } from '@tanstack/react-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { authInputClassName, authPrimaryButtonClassName, Field } from '@/features/auth/auth-field';
import { AuthFooterLink, AuthIntro, AuthPanel } from '@/features/auth/auth-layout';
import { authClient, resolveMailCooldownErrorMessage } from '@/lib/auth';
import { looksLikeEmail } from '@/lib/auth/api';
import { isEmailNotVerifiedError } from '@/lib/auth/auth-errors';
import { signInSchema } from '@/lib/validations';

function isEmailVerificationRequired(error: { status?: number; code?: string | number } | null): boolean {
  if (!error) {
    return false;
  }
  return isEmailNotVerifiedError(error.code);
}

export function SignInForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isVerificationRequired, setIsVerificationRequired] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const form = useForm({
    defaultValues: {
      login: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setIsVerificationRequired(false);
      const parsed = signInSchema.safeParse(value);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? '输入有误');
        return;
      }

      const { error } = await authClient.login(parsed.data);

      if (error) {
        if (isEmailVerificationRequired(error)) {
          setIsVerificationRequired(true);
          setFormError('请先打开邮箱里的验证链接，确认后再登录。');
          return;
        }
        const message = error.message || '登录失败';
        setFormError(message);
        toast.error(message);
        return;
      }

      toast.success('登录成功');
      router.replace(AUTH_ROUTES.dashboard);
      router.refresh();
    },
  });

  async function handleResendVerification() {
    const login = form.state.values.login.trim();
    if (!login || isResending) {
      return;
    }

    if (!looksLikeEmail(login)) {
      const message = '请用注册邮箱登录后再重发验证邮件，或到注册页使用邮箱账号。';
      setFormError(message);
      toast.error(message);
      return;
    }

    setIsResending(true);
    const { error } = await authClient.resendVerificationEmail(login);
    setIsResending(false);

    if (error) {
      const cooldownMessage = resolveMailCooldownErrorMessage(error);
      const message = cooldownMessage || error.message || '发送失败，请稍后重试';
      setFormError(message);
      toast.error(message);
      return;
    }

    toast.success('验证邮件已发送');
  }

  return (
    <>
      <AuthIntro title="登录" />

      <AuthPanel>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="login">
            {(field) => (
              <Field label="邮箱或用户名" htmlFor="sign-in-login">
                <input
                  id="sign-in-login"
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com"
                  className={authInputClassName}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field
                label="密码"
                htmlFor="sign-in-password"
                labelAside={
                  <Link
                    href={AUTH_ROUTES.forgotPassword}
                    className="text-sm text-muted-foreground transition-colors duration-300 ease-out-soft hover:text-primary"
                  >
                    忘记密码？
                  </Link>
                }
              >
                <input
                  id="sign-in-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={authInputClassName}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          {isVerificationRequired ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isResending}
              onClick={() => {
                void handleResendVerification();
              }}
            >
              {isResending ? '发送中…' : '重新发送验证邮件'}
            </Button>
          ) : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
                {isSubmitting ? '登录中…' : '登录'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </AuthPanel>

      <AuthFooterLink prompt="还没有账号？" href={AUTH_ROUTES.signUp} label="注册" />
    </>
  );
}

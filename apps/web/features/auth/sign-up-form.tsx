'use client';

import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { authInputClassName, authPrimaryButtonClassName, Field } from '@/features/auth/auth-field';
import { AuthFooterLink, AuthIntro, AuthPanel } from '@/features/auth/auth-layout';
import { authClient } from '@/lib/auth';
import { signUpSchema } from '@/lib/validations';

function dashboardCallbackUrl(): string {
  return new URL(AUTH_ROUTES.dashboard, window.location.origin).toString();
}

export function SignUpForm() {
  const [isSent, setIsSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const form = useForm({
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const parsed = signUpSchema.safeParse(value);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? '输入有误');
        return;
      }

      const { error } = await authClient.signUp.email({
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
        username: parsed.data.username,
        callbackURL: dashboardCallbackUrl(),
      });

      if (error) {
        const message = error.message || '注册失败';
        setFormError(message);
        toast.error(message);
        return;
      }

      setSubmittedEmail(parsed.data.email);
      setIsSent(true);
    },
  });

  async function handleResend() {
    if (!submittedEmail || isResending) {
      return;
    }

    setFormError(null);
    setIsResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email: submittedEmail,
      callbackURL: dashboardCallbackUrl(),
    });
    setIsResending(false);

    if (error) {
      const message = error.message || '发送失败，请稍后重试';
      setFormError(message);
      toast.error(message);
      return;
    }

    toast.success('验证邮件已重新发送');
  }

  if (isSent) {
    return (
      <>
        <AuthIntro
          eyebrow="邮件已发出"
          title="去邮箱点开链接"
          description={`我们已向 ${submittedEmail} 发送确认链接（约 1 小时内有效）。点开后会自动登录。没收到就看垃圾箱，或再发一次。`}
        />

        <AuthPanel>
          {formError ? <p className="mb-4 text-sm text-destructive">{formError}</p> : null}
          <Button
            type="button"
            className={authPrimaryButtonClassName}
            disabled={isResending}
            onClick={() => {
              void handleResend();
            }}
          >
            {isResending ? '发送中…' : '再发一次'}
          </Button>
        </AuthPanel>

        <AuthFooterLink href={AUTH_ROUTES.signIn} label="去登录" />
      </>
    );
  }

  return (
    <>
      <AuthIntro
        eyebrow="注册"
        title="先有个账号，再开始读"
        description="不复杂。填几项就行——产品还在打磨，但方向是认真的。"
      />

      <AuthPanel>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Field label="显示名" htmlFor="sign-up-name">
                <input
                  id="sign-up-name"
                  type="text"
                  autoComplete="name"
                  placeholder="怎么称呼你"
                  className={authInputClassName}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="username">
            {(field) => (
              <Field label="用户名" htmlFor="sign-up-username">
                <input
                  id="sign-up-username"
                  type="text"
                  autoComplete="username"
                  placeholder="英文或数字，用于登录标识"
                  className={authInputClassName}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <Field label="邮箱" htmlFor="sign-up-email">
                <input
                  id="sign-up-email"
                  type="email"
                  autoComplete="email"
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
              <Field label="密码" htmlFor="sign-up-password">
                <input
                  id="sign-up-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="至少 8 位"
                  className={authInputClassName}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className={`mt-2 ${authPrimaryButtonClassName}`} disabled={isSubmitting}>
                {isSubmitting ? '创建中…' : '创建账号'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </AuthPanel>

      <AuthFooterLink prompt="已有账号？" href={AUTH_ROUTES.signIn} label="登录" />
    </>
  );
}

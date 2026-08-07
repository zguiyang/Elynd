'use client';

import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { authInputClassName, authPrimaryButtonClassName, Field } from '@/features/auth/auth-field';
import { AuthFooterLink, AuthIntro, AuthPanel } from '@/features/auth/auth-layout';
import { authClient, resolveMailCooldownErrorMessage } from '@/lib/auth';
import { forgotPasswordSchema } from '@/lib/validations';

export function ForgotPasswordForm() {
  const [isSent, setIsSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const parsed = forgotPasswordSchema.safeParse(value);
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? '输入有误');
        return;
      }

      const { error } = await authClient.forgotPassword(parsed.data.email);

      if (error) {
        const cooldownMessage = resolveMailCooldownErrorMessage(error);
        const message = cooldownMessage || error.message || '发送失败，请稍后重试';
        setFormError(message);
        toast.error(message);
        return;
      }

      setIsSent(true);
    },
  });

  if (isSent) {
    return (
      <>
        <AuthIntro
          eyebrow="邮件已发出"
          title="去邮箱点开链接"
          description="点开后设新密码，保存后再登录。没收到就看垃圾箱，或再发一次。"
        />

        <AuthPanel>
          <Button
            type="button"
            className={authPrimaryButtonClassName}
            onClick={() => {
              setIsSent(false);
              setFormError(null);
            }}
          >
            再发一次
          </Button>
        </AuthPanel>

        <AuthFooterLink href={AUTH_ROUTES.signIn} label="返回登录" />
      </>
    );
  }

  return (
    <>
      <AuthIntro
        eyebrow="找回密码"
        title="忘了也没关系"
        description="留下邮箱，我会发一封带链接的邮件。点开设新密码，保存后再登录。"
      />

      <AuthPanel>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <Field label="邮箱" htmlFor="forgot-email">
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="注册时用的邮箱"
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
              <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
                {isSubmitting ? '发送中…' : '发送邮件'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </AuthPanel>

      <AuthFooterLink href={AUTH_ROUTES.signIn} label="返回登录" />
    </>
  );
}

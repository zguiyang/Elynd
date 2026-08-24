'use client';

import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  authDialogFieldStackClassName,
  authDialogFormClassName,
  authInputClassName,
  authPrimaryButtonClassName,
  Field,
} from '@/features/auth/auth-field';
import { AuthIntro, AuthPanel } from '@/features/auth/auth-layout';
import { authClient, resolveMailCooldownErrorMessage } from '@/lib/auth';
import { signUpSchema } from '@/lib/validations';

export function SignUpForm({ embedded = false }: { embedded?: boolean }) {
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

      const { error } = await authClient.register({
        email: parsed.data.email,
        password: parsed.data.password,
        username: parsed.data.username,
        name: parsed.data.name,
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
    const { error } = await authClient.resendVerificationEmail(submittedEmail);
    setIsResending(false);

    if (error) {
      const cooldownMessage = resolveMailCooldownErrorMessage(error);
      const message = cooldownMessage || error.message || '发送失败，请稍后重试';
      setFormError(message);
      toast.error(message);
      return;
    }

    toast.success('验证邮件已重新发送');
  }

  if (isSent) {
    return (
      <>
        {!embedded ? (
          <AuthIntro title="去邮箱点开链接" description={`已发送至 ${submittedEmail}，约 1 小时有效。`} />
        ) : null}

        <AuthPanel variant={embedded ? 'plain' : 'card'}>
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
      </>
    );
  }

  return (
    <>
      {!embedded ? <AuthIntro title="注册" /> : null}

      <AuthPanel variant={embedded ? 'plain' : 'card'}>
        <form
          className={embedded ? authDialogFormClassName : 'space-y-4'}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className={embedded ? authDialogFieldStackClassName : 'contents'}>
            <form.Field name="name">
              {(field) => (
                <Field hideLabel={embedded} label="显示名" htmlFor="sign-up-name">
                  <input
                    id="sign-up-name"
                    type="text"
                    autoComplete="name"
                    placeholder={embedded ? '显示名' : '怎么称呼你'}
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
                <Field hideLabel={embedded} label="用户名" htmlFor="sign-up-username">
                  <input
                    id="sign-up-username"
                    type="text"
                    autoComplete="username"
                    placeholder={embedded ? '用户名' : '英文或数字，用于登录标识'}
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
                <Field hideLabel={embedded} label="邮箱" htmlFor="sign-up-email">
                  <input
                    id="sign-up-email"
                    type="email"
                    autoComplete="email"
                    placeholder={embedded ? '邮箱' : 'you@example.com'}
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
                <Field hideLabel={embedded} label="密码" htmlFor="sign-up-password">
                  <input
                    id="sign-up-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={embedded ? '密码（至少 8 位）' : '至少 8 位'}
                    className={authInputClassName}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
                {isSubmitting ? '创建中…' : '创建账号'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </AuthPanel>
    </>
  );
}

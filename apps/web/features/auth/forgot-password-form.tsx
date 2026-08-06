'use client';

import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { authInputClassName, authPrimaryButtonClassName, Field } from '@/features/auth/auth-field';
import { AuthFooterLink, AuthIntro, AuthPanel } from '@/features/auth/auth-layout';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    toast.message('找回密码暂未开通', {
      description: '页面先留在这里，发邮件能力后续再接。',
    });
  }

  return (
    <>
      <AuthIntro
        eyebrow="找回密码"
        title="忘了也没关系"
        description="留下邮箱，之后会发一封带链接的邮件。点开设新密码即可——目前发信功能尚未开通。"
      />

      <AuthPanel>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <Field label="邮箱" htmlFor="forgot-email">
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              placeholder="注册时用的邮箱"
              className={authInputClassName}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Button type="submit" className={authPrimaryButtonClassName}>
            发送邮件
          </Button>
        </form>
      </AuthPanel>

      <AuthFooterLink href={AUTH_ROUTES.signIn} label="返回登录" />
    </>
  );
}

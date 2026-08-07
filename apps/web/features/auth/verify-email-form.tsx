'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { authPrimaryButtonClassName } from '@/features/auth/auth-field';
import { AuthIntro, AuthPanel } from '@/features/auth/auth-layout';
import { authClient } from '@/lib/auth';

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>(() => (token ? 'pending' : 'error'));
  const [message, setMessage] = useState(() => (token ? '正在确认邮箱…' : '验证链接无效或已过期'));

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const { error } = await authClient.verifyEmail(token);
      if (cancelled) {
        return;
      }
      if (error) {
        setStatus('error');
        setMessage(error.message || '验证失败，请重新申请邮件');
        toast.error(error.message || '验证失败');
        return;
      }
      setStatus('ok');
      setMessage('邮箱已确认，可以登录了');
      toast.success('邮箱已确认');
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <AuthIntro
        eyebrow="确认邮箱"
        title={status === 'ok' ? '搞定了' : status === 'error' ? '没能确认' : '稍等一下'}
        description={message}
      />

      <AuthPanel>
        {status === 'pending' ? <p className="text-sm text-muted-foreground">确认中…</p> : null}
        {status === 'ok' ? (
          <Button
            type="button"
            className={authPrimaryButtonClassName}
            onClick={() => {
              router.replace(AUTH_ROUTES.signIn);
            }}
          >
            去登录
          </Button>
        ) : null}
        {status === 'error' ? (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className={authPrimaryButtonClassName}
              onClick={() => {
                router.replace(AUTH_ROUTES.signIn);
              }}
            >
              返回登录
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                router.replace(AUTH_ROUTES.signUp);
              }}
            >
              重新注册或重发邮件
            </Button>
          </div>
        ) : null}
      </AuthPanel>
    </>
  );
}

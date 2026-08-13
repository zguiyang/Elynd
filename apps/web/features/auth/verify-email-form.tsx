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
  const [message, setMessage] = useState<string | undefined>(() => (token ? undefined : '验证链接无效或已过期'));

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
      setMessage(undefined);
      toast.success('邮箱已确认');
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <AuthIntro
        title={status === 'ok' ? '邮箱已确认' : status === 'error' ? '确认失败' : '确认中'}
        description={message}
      />

      {status !== 'pending' ? (
        <AuthPanel>
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
      ) : null}
    </>
  );
}

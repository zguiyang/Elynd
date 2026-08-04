'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { APP_NAME, AUTH_ROUTES } from '@/constants'
import { authClient, clearAuthToken, getAuthToken } from '@/lib/auth'

type SessionUser = {
  id?: string
  email?: string
  name?: string
  username?: string | null
}

export function DashboardPanel() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      const token = getAuthToken()
      if (!token) {
        router.replace(AUTH_ROUTES.signIn)
        return
      }

      const { data, error } = await authClient.getSession()
      if (cancelled) {
        return
      }

      if (error || !data?.user) {
        clearAuthToken()
        router.replace(AUTH_ROUTES.signIn)
        return
      }

      setUser(data.user as SessionUser)
      setLoading(false)
    }

    void loadSession()
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSignOut() {
    try {
      await authClient.signOut()
    } catch {
      // Clear local token even if the API call fails.
    }
    clearAuthToken()
    toast.success('Signed out')
    router.replace(AUTH_ROUTES.signIn)
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">You are signed in with a Bearer session.</p>
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium text-foreground">{user?.name ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-medium text-foreground">{user?.username ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium text-foreground">{user?.email ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
        <Link
          href="/"
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Home
        </Link>
      </div>
    </main>
  )
}

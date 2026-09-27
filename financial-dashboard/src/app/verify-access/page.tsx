'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { ArrowLeft, Loader2, MailX, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAppAuth } from '@/lib/auth'
import { isLocalDevMockMode } from '@/lib/devMode'
import { useAuthedFetch } from '@/lib/useAuthedFetch'

type VerifyState = 'checking' | 'rejected' | 'error'

function getSafeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}

function getRejectedUrl(next: string): string {
  return `/verify-access?status=rejected&next=${encodeURIComponent(next)}`
}

export default function VerifyAccessPage() {
  if (isLocalDevMockMode) {
    return <MockRedirect />
  }

  return <VerifyAccess />
}

function MockRedirect() {
  const router = useRouter()
  React.useEffect(() => {
    router.replace(getSafeNextPath())
  }, [router])
  return null
}

function VerifyAccess() {
  const router = useRouter()
  const { signOut } = useClerk()
  const { isLoaded, isSignedIn } = useAppAuth()
  const authedFetch = useAuthedFetch()
  const [state, setState] = React.useState<VerifyState>('checking')
  const [nextPath, setNextPath] = React.useState('/dashboard')
  const hasStartedRef = React.useRef(false)

  const verify = React.useCallback(async () => {
    const next = getSafeNextPath()
    setNextPath(next)
    setState('checking')

    try {
      const response = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-gmail-access`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = (await response.json()) as { status: 'ok' | 'gmail_scope_missing'; deleted?: boolean }
      if (result.status === 'gmail_scope_missing' && result.deleted) {
        // The account is already gone server-side; clear the now-dead local session.
        await signOut({ redirectUrl: getRejectedUrl(next) }).catch(() => {
          window.location.assign(getRejectedUrl(next))
        })
        return
      }

      // Existing users missing the scope are sent on; the dashboard's reconnect prompt handles them.
      router.replace(next)
    } catch (error) {
      console.error('Failed to verify Gmail access:', error)
      setState('error')
    }
  }, [authedFetch, router, signOut])

  React.useEffect(() => {
    if (!isLoaded || hasStartedRef.current) {
      return
    }
    if (new URLSearchParams(window.location.search).get('status') === 'rejected') {
      hasStartedRef.current = true
      setNextPath(getSafeNextPath())
      setState('rejected')
      return
    }
    if (!isSignedIn) {
      router.replace('/dashboard')
      return
    }
    hasStartedRef.current = true
    void verify()
  }, [isLoaded, isSignedIn, router, verify])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="relative w-full max-w-md rounded-[1.75rem] border-border/70 bg-card/90 text-center shadow-xl backdrop-blur">
        {state === 'checking' ? (
          <CardHeader className="items-center gap-4 py-4">
            <Image
              src="/app-logo.png"
              alt="GPay Cost Analyzer logo"
              width={56}
              height={56}
              className="mx-auto rounded-full shadow-sm ring-1 ring-border/70"
            />
            <div className="space-y-1.5">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight">
                <Loader2 className="size-5 animate-spin text-primary" />
                Checking Gmail access
              </CardTitle>
              <CardDescription className="leading-6">
                Making sure Google shared read-only access to your payment alert emails.
              </CardDescription>
            </div>
          </CardHeader>
        ) : null}

        {state === 'rejected' ? (
          <>
            <CardHeader className="items-center gap-4">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <MailX className="size-6" />
              </span>
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Gmail access wasn&apos;t granted
                </CardTitle>
                <CardDescription className="leading-6">
                  The &ldquo;View your email messages and settings&rdquo; box was left unticked, so we
                  cancelled your sign-up and didn&apos;t keep any of your details. The app can&apos;t
                  find your transactions without it.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <GoogleSignInButton redirectUrlComplete={nextPath} />
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/">
                  <ArrowLeft className="size-4" />
                  Back to home
                </Link>
              </Button>
            </CardContent>
          </>
        ) : null}

        {state === 'error' ? (
          <>
            <CardHeader className="items-center gap-4">
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Couldn&apos;t confirm Gmail access
                </CardTitle>
                <CardDescription className="leading-6">
                  Something went wrong while checking your Google permissions. Please try again.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <Button className="h-11 rounded-xl px-4" onClick={() => void verify()}>
                <RotateCw className="size-4" />
                Try again
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/">
                  <ArrowLeft className="size-4" />
                  Back to home
                </Link>
              </Button>
            </CardContent>
          </>
        ) : null}
      </Card>
    </main>
  )
}

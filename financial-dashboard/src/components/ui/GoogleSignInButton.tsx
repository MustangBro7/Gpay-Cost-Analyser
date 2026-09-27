'use client'

import * as React from 'react'
import Link from 'next/link'
import { ClerkLoaded, ClerkLoading } from '@clerk/nextjs'
import { useAppSignIn } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { ArrowRight, Check, Chrome, Mail, ShieldAlert, UserRound } from 'lucide-react'

function getSsoCallbackUrl(): string {
  return new URL('/sso-callback', window.location.origin).toString()
}

/** Every Google sign-in lands on /verify-access first, which rejects sign-ups without Gmail consent. */
export function getVerifyAccessUrl(next: string): string {
  return `/verify-access?next=${encodeURIComponent(next)}`
}

function ConsentScreenPreview() {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">On Google&apos;s screen</p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/85 px-3 py-2.5">
          <UserRound className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            See your personal info and email address
          </span>
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Check className="size-3.5" />
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2.5 ring-2 ring-primary/30">
          <Mail className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
            View your email messages and settings
          </span>
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        This box starts <span className="font-medium text-foreground">unticked</span>. Tick it (or tap
        &ldquo;Select all&rdquo;) before pressing Continue.
      </p>
    </div>
  )
}

export function GoogleSignInButton({
  redirectUrlComplete = '/dashboard',
}: {
  redirectUrlComplete?: string
}) {
  const { isLoaded, signIn } = useAppSignIn()
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [hasAcknowledged, setHasAcknowledged] = React.useState(false)
  const [isRedirecting, setIsRedirecting] = React.useState(false)

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (isRedirecting) {
        return
      }
      setIsDialogOpen(open)
      if (!open) {
        setHasAcknowledged(false)
      }
    },
    [isRedirecting]
  )

  const handleSignIn = React.useCallback(async () => {
    if (!isLoaded || !signIn || isRedirecting || !hasAcknowledged) {
      return
    }

    setIsRedirecting(true)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: getSsoCallbackUrl(),
        redirectUrlComplete: getVerifyAccessUrl(redirectUrlComplete),
        continueSignIn: true,
        continueSignUp: true,
        oidcPrompt: 'consent',
      })
    } catch (error) {
      console.error('Failed to start Google sign-in:', error)
      setIsRedirecting(false)
    }
  }, [hasAcknowledged, isLoaded, isRedirecting, redirectUrlComplete, signIn])

  return (
    <>
      <ClerkLoading>
        <Button disabled className="h-11 rounded-xl px-4">
          Loading sign-in...
        </Button>
      </ClerkLoading>
      <ClerkLoaded>
        <Button
          onClick={() => setIsDialogOpen(true)}
          disabled={!isLoaded}
          className="h-11 rounded-xl px-4"
        >
          <Chrome className="size-4" />
          Continue with Google
          <ArrowRight className="size-4" />
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="text-left sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Allow Gmail access on the next screen
              </DialogTitle>
              <DialogDescription className="leading-6">
                GPay Cost Analyzer builds your dashboard from the payment alert emails in your inbox,
                so read-only Gmail access is required. If you leave it unticked, your sign-up is
                cancelled and nothing is saved.
              </DialogDescription>
            </DialogHeader>

            <ConsentScreenPreview />

            <div className="flex gap-3 rounded-2xl border border-border/60 bg-background/85 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldAlert className="size-4" />
              </span>
              <p className="text-sm leading-6 text-muted-foreground">
                Seeing <span className="font-medium text-foreground">&ldquo;Google hasn&apos;t verified this app&rdquo;</span>?
                That&apos;s expected for this independent app. Tap{' '}
                <span className="font-medium text-foreground">Advanced</span>, then the{' '}
                <span className="font-medium text-foreground">&ldquo;Go to … (unsafe)&rdquo;</span> link.
              </p>
            </div>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors',
                hasAcknowledged ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-card/90'
              )}
            >
              <input
                type="checkbox"
                checked={hasAcknowledged}
                onChange={(event) => setHasAcknowledged(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm leading-6">
                I&apos;ll tick <span className="font-medium">&ldquo;View your email messages and settings&rdquo;</span> on
                Google&apos;s screen and agree to the{' '}
                <Link href="/privacy" target="_blank" className="text-primary underline underline-offset-4">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/terms" target="_blank" className="text-primary underline underline-offset-4">
                  Terms
                </Link>
                .
              </span>
            </label>

            <DialogFooter>
              <Button
                variant="outline"
                className="h-11 rounded-full px-5"
                disabled={isRedirecting}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-11 rounded-xl px-5"
                disabled={!hasAcknowledged || !signIn || isRedirecting}
                onClick={handleSignIn}
              >
                <Chrome className="size-4" />
                {isRedirecting ? 'Opening Google…' : 'Continue to Google'}
                {!isRedirecting ? <ArrowRight className="size-4" /> : null}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ClerkLoaded>
    </>
  )
}

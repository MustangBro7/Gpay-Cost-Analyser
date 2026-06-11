'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { AppSignedIn, AppSignedOut } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton'

/**
 * Landing-page call to action that adapts to auth state: signed-out visitors
 * get the Google sign-in flow (which lands on /dashboard), signed-in users
 * go straight to their dashboard.
 */
export function SmartCta({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <AppSignedOut>
        {compact ? (
          <Button asChild variant="outline" className="h-10 rounded-full px-4">
            <Link href="/dashboard">Sign in</Link>
          </Button>
        ) : (
          <GoogleSignInButton redirectUrlComplete="/dashboard" />
        )}
      </AppSignedOut>
      <AppSignedIn>
        <Button
          asChild
          variant={compact ? 'outline' : 'default'}
          className={compact ? 'h-10 rounded-full px-4' : 'h-11 rounded-xl px-4'}
        >
          <Link href="/dashboard">
            <LayoutDashboard className="size-4" />
            {compact ? 'Dashboard' : 'Open your dashboard'}
            {!compact ? <ArrowRight className="size-4" /> : null}
          </Link>
        </Button>
      </AppSignedIn>
    </>
  )
}

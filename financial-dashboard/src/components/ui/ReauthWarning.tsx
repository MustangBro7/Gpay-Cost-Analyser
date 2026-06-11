'use client'

import * as React from 'react'
import { AlertTriangle, LogIn, Clock } from 'lucide-react'
import { useClerk } from '@clerk/nextjs'
import { useAppSignIn, useAppUser } from '@/lib/auth'
import { isLocalDevMockMode } from '@/lib/devMode'
import { Button } from './button'
import { useTokenStatus } from '@/hooks/useTokenStatus'
import { cn } from '@/lib/utils'

interface ReauthWarningProps {
  className?: string
  userId?: string
  userEmail?: string
}

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const CLERK_GOOGLE_PROVIDERS = new Set(['google', 'oauth_google'])

function formatTimeRemaining(hours: number): string {
  if (hours <= 0) return 'Expired'
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  if (minutes === 0) {
    return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`
  }
  return `${wholeHours}h ${minutes}m`
}

function getCleanRedirectUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('reauth')
  return url.toString()
}

function getSsoCallbackUrl(): string {
  const callbackUrl = new URL('/sso-callback', window.location.origin)
  callbackUrl.searchParams.set('redirect_url', getCleanRedirectUrl())
  return callbackUrl.toString()
}

function getExternalVerificationRedirectUrl(
  externalAccount: {
    verification?: {
      externalVerificationRedirectURL?: URL | string | null
    } | null
  } | null | undefined
): string | null {
  const redirectUrl = externalAccount?.verification?.externalVerificationRedirectURL
  if (!redirectUrl) {
    return null
  }

  return typeof redirectUrl === 'string' ? redirectUrl : redirectUrl.toString()
}

async function startGoogleRedirect(
  signIn: NonNullable<ReturnType<typeof useAppSignIn>['signIn']>,
  redirectUrlComplete: string
) {
  await signIn.authenticateWithRedirect({
    strategy: 'oauth_google',
    redirectUrl: getSsoCallbackUrl(),
    redirectUrlComplete,
    continueSignIn: true,
    continueSignUp: true,
    oidcPrompt: 'consent',
  })
}

async function startGoogleReconnect(
  user: ReturnType<typeof useAppUser>['user'],
  signIn: NonNullable<ReturnType<typeof useAppSignIn>['signIn']>,
  redirectUrlComplete: string
) {
  if (user) {
    try {
      const existingGoogleAccount = user.externalAccounts.find((account) =>
        CLERK_GOOGLE_PROVIDERS.has(account.provider)
      )

      const externalAccount = existingGoogleAccount
        ? await existingGoogleAccount.reauthorize({
            additionalScopes: [GMAIL_READONLY_SCOPE],
            redirectUrl: getSsoCallbackUrl(),
          })
        : await user.createExternalAccount({
            strategy: 'oauth_google',
            additionalScopes: [GMAIL_READONLY_SCOPE],
            redirectUrl: getSsoCallbackUrl(),
            oidcPrompt: 'consent',
          })

      const externalVerificationRedirectUrl = getExternalVerificationRedirectUrl(externalAccount)
      if (externalVerificationRedirectUrl) {
        window.location.assign(externalVerificationRedirectUrl)
        return
      }

      console.warn('Google external account reconnect did not return a redirect URL. Falling back to sign-in redirect.')
    } catch (error) {
      console.warn('Google external account reconnect did not start. Falling back to sign-in redirect.', error)
    }
  }

  await startGoogleRedirect(signIn, redirectUrlComplete)
}

export function ReauthWarning(props: ReauthWarningProps) {
  // useClerk requires ClerkProvider, which AuthProvider skips in mock mode —
  // bail out before any Clerk hooks run.
  if (isLocalDevMockMode) {
    return null
  }

  return <ReauthWarningInner {...props} />
}

function ReauthWarningInner({ className, userId, userEmail }: ReauthWarningProps) {
  const { needsReauth, urgentUser, isLoading } = useTokenStatus({ pollInterval: 300000 })
  const { isLoaded, signIn } = useAppSignIn()
  const { isLoaded: isUserLoaded, user } = useAppUser()
  const { signOut } = useClerk()
  const [isRedirecting, setIsRedirecting] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const hasAutoTriggeredRef = React.useRef(false)
  const shouldRender = !isLoading && needsReauth && Boolean(urgentUser)
  const isExpired = urgentUser ? urgentUser.hours_remaining <= 0 : false
  const timeRemaining = urgentUser ? formatTimeRemaining(urgentUser.hours_remaining) : ''
  const toneClasses = isExpired
    ? {
        surface: 'bg-destructive/10 text-destructive',
        icon: 'bg-destructive/15 text-destructive',
        emphasis: 'text-destructive',
      }
    : {
        surface: 'bg-primary/10 text-primary',
        icon: 'bg-primary/15 text-primary',
        emphasis: 'text-primary',
      }

  const handleReauth = React.useCallback(async () => {
    if (isRedirecting || isSigningOut || !isLoaded || !isUserLoaded || !signIn) {
      return
    }

    setIsRedirecting(true)
    try {
      const redirectUrlComplete = getCleanRedirectUrl()
      await startGoogleReconnect(user, signIn, redirectUrlComplete)
    } catch (error) {
      console.error('Failed to start Google re-authentication:', error)
      setIsRedirecting(false)
    }
  }, [isLoaded, isRedirecting, isSigningOut, isUserLoaded, signIn, user])

  const handleResetSignIn = React.useCallback(async () => {
    if (isRedirecting || isSigningOut) {
      return
    }

    setIsSigningOut(true)
    try {
      await signOut({ redirectUrl: getCleanRedirectUrl() })
    } catch (error) {
      console.error('Failed to sign out before restarting sign-in:', error)
      setIsSigningOut(false)
    }
  }, [isRedirecting, isSigningOut, signOut])

  React.useEffect(() => {
    if (!shouldRender || hasAutoTriggeredRef.current || isRedirecting) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('reauth') !== 'google') {
      return
    }

    hasAutoTriggeredRef.current = true
    void handleReauth()
  }, [handleReauth, isRedirecting, shouldRender])

  if (!shouldRender || !urgentUser) {
    return null
  }

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center ${className || ''}`}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
          <div className={cn('px-6 py-4', toneClasses.surface)}>
            <div className="flex items-center gap-3">
              <div className={cn('rounded-full p-2', toneClasses.icon)}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isExpired ? 'Google Access Required' : 'Google Access Needs Attention'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {urgentUser.google_email || userEmail || userId || urgentUser.user_id}
                </p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-muted-foreground">
              {isExpired 
                ? 'Sign in with Google again through Clerk before email monitoring can continue.'
                : 'Your Google account needs to be reconnected in Clerk so Gmail monitoring can continue.'
              }
            </p>
            
            {!isExpired && (
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 p-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last known window:</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    urgentUser.hours_remaining < 1 ? 'text-destructive' : toneClasses.emphasis
                  )}
                >
                  {timeRemaining}
                </span>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground/80 italic">
              Note: Transaction monitoring is paused until your Google sign-in includes Gmail read access.
            </p>
          </div>
          
          <div className="px-6 py-4 bg-muted/30 border-t border-border">
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleReauth}
                className="w-full gap-2 rounded-xl"
                size="lg"
                disabled={!isLoaded || !isUserLoaded || !signIn || isRedirecting || isSigningOut}
              >
                <LogIn className="w-4 h-4" />
                {isRedirecting ? 'Opening sign-in...' : 'Sign In With Google Again'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                disabled={isRedirecting || isSigningOut}
                onClick={handleResetSignIn}
              >
                {isSigningOut ? 'Signing out...' : 'Sign Out And Start Over'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

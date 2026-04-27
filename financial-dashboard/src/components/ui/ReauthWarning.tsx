'use client'

import * as React from 'react'
import { AlertTriangle, LogIn, Clock } from 'lucide-react'
import { useSignIn, useUser } from '@clerk/nextjs'
import { Button } from './button'
import { useTokenStatus } from '@/hooks/useTokenStatus'

interface ReauthWarningProps {
  className?: string
  userId?: string
  userEmail?: string
}

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

export function ReauthWarning({ className, userId, userEmail }: ReauthWarningProps) {
  const { needsReauth, urgentUser, isLoading } = useTokenStatus({ pollInterval: 30000 })
  const { isLoaded, signIn } = useSignIn()
  const { user } = useUser()
  const [isRedirecting, setIsRedirecting] = React.useState(false)
  const hasAutoTriggeredRef = React.useRef(false)

  // Don't render anything if no re-auth needed or still loading
  if (isLoading || !needsReauth || !urgentUser) {
    return null
  }

  const isExpired = urgentUser.hours_remaining <= 0
  const timeRemaining = formatTimeRemaining(urgentUser.hours_remaining)

  const handleReauth = async () => {
    if (isRedirecting) return

    setIsRedirecting(true)
    try {
      const googleAccount = user?.externalAccounts?.find((account) => account.provider === 'google')

      if (googleAccount) {
        await googleAccount.reauthorize({
          additionalScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
          oidcPrompt: 'consent',
          redirectUrl: getCleanRedirectUrl(),
        })
        return
      }

      if (!isLoaded || !signIn) {
        throw new Error('Clerk sign-in is not ready yet.')
      }

      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: getCleanRedirectUrl(),
        continueSignIn: true,
        continueSignUp: true,
        oidcPrompt: 'consent',
      })
    } catch (error) {
      console.error('Failed to start Google re-authentication:', error)
      setIsRedirecting(false)
    }
  }

  React.useEffect(() => {
    if (hasAutoTriggeredRef.current || isLoading || !needsReauth || isRedirecting) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('reauth') !== 'google') {
      return
    }

    hasAutoTriggeredRef.current = true
    void handleReauth()
  }, [isLoading, needsReauth, isRedirecting])

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center ${className || ''}`}>
      {/* Backdrop - semi-transparent with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Warning Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header with warning stripe */}
          <div className={`px-6 py-4 ${isExpired ? 'bg-destructive/20' : 'bg-amber-500/20'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isExpired ? 'bg-destructive/30' : 'bg-amber-500/30'}`}>
                <AlertTriangle className={`w-6 h-6 ${isExpired ? 'text-destructive' : 'text-amber-500'}`} />
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
            
            {/* Time remaining display */}
            {!isExpired && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last known window:</span>
                <span className={`text-sm font-semibold ${urgentUser.hours_remaining < 1 ? 'text-destructive' : 'text-amber-500'}`}>
                  {timeRemaining}
                </span>
              </div>
            )}
            
            {/* Warning note */}
            <p className="text-xs text-muted-foreground/80 italic">
              Note: Transaction monitoring is paused until your Google sign-in includes Gmail read access.
            </p>
          </div>
          
          {/* Footer with action button */}
          <div className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button 
              onClick={handleReauth}
              className="w-full gap-2"
              size="lg"
              disabled={isRedirecting}
            >
              <LogIn className="w-4 h-4" />
              {isRedirecting ? 'Opening sign-in...' : 'Sign In With Google Again'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

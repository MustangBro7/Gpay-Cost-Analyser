'use client'

import * as React from 'react'
import { ClerkLoaded, ClerkLoading } from '@clerk/nextjs'
import { useAppSignIn } from '@/lib/auth'
import { Button } from './button'
import { ArrowRight, Chrome } from 'lucide-react'

function getSsoCallbackUrl(): string {
  return new URL('/sso-callback', window.location.origin).toString()
}

export function GoogleSignInButton({
  redirectUrlComplete = '/dashboard',
}: {
  redirectUrlComplete?: string
}) {
  const { isLoaded, signIn } = useAppSignIn()
  const [isRedirecting, setIsRedirecting] = React.useState(false)

  const handleSignIn = React.useCallback(async () => {
    if (!isLoaded || !signIn || isRedirecting) {
      return
    }

    setIsRedirecting(true)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: getSsoCallbackUrl(),
        redirectUrlComplete,
        continueSignIn: true,
        continueSignUp: true,
        oidcPrompt: 'consent',
      })
    } catch (error) {
      console.error('Failed to start Google sign-in:', error)
      setIsRedirecting(false)
    }
  }, [isLoaded, isRedirecting, redirectUrlComplete, signIn])

  return (
    <>
      <ClerkLoading>
        <Button disabled className="h-11 rounded-xl px-4">
          Loading sign-in...
        </Button>
      </ClerkLoading>
      <ClerkLoaded>
        <Button
          onClick={handleSignIn}
          disabled={!isLoaded || isRedirecting}
          className="h-11 rounded-xl px-4"
        >
          <Chrome className="size-4" />
          {isRedirecting ? 'Opening Google…' : 'Continue with Google'}
          {!isRedirecting ? <ArrowRight className="size-4" /> : null}
        </Button>
      </ClerkLoaded>
    </>
  )
}

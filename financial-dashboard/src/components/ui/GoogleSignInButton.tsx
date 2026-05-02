'use client'

import * as React from 'react'
import { ClerkLoaded, ClerkLoading } from '@clerk/nextjs'
import { useAppSignIn } from '@/lib/auth'
import { Button } from './button'

function getSsoCallbackUrl(): string {
  return new URL('/sso-callback', window.location.origin).toString()
}

export function GoogleSignInButton() {
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
        redirectUrlComplete: '/',
        continueSignIn: true,
        continueSignUp: true,
        oidcPrompt: 'consent',
      })
    } catch (error) {
      console.error('Failed to start Google sign-in:', error)
      setIsRedirecting(false)
    }
  }, [isLoaded, isRedirecting, signIn])

  return (
    <>
      <ClerkLoading>
        <Button disabled>Loading sign-in...</Button>
      </ClerkLoading>
      <ClerkLoaded>
        <Button onClick={handleSignIn} disabled={!isLoaded || isRedirecting}>
          {isRedirecting ? 'Opening Google…' : 'Continue with Google'}
        </Button>
      </ClerkLoaded>
    </>
  )
}

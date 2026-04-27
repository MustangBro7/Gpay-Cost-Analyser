'use client'

import * as React from 'react'
import { useSignIn } from '@clerk/nextjs'
import { Button } from './button'

export function GoogleSignInButton() {
  const { isLoaded, signIn } = useSignIn()
  const [isRedirecting, setIsRedirecting] = React.useState(false)

  const handleClick = async () => {
    if (!isLoaded || !signIn || isRedirecting) {
      return
    }

    setIsRedirecting(true)
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
        continueSignIn: true,
        continueSignUp: true,
      })
    } catch (error) {
      console.error('Failed to start Google sign-in:', error)
      setIsRedirecting(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={!isLoaded || isRedirecting}>
      {isRedirecting ? 'Redirecting...' : 'Continue with Google'}
    </Button>
  )
}

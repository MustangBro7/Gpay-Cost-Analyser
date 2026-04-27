'use client'

import * as React from 'react'
import { SignInButton } from '@clerk/nextjs'
import { Button } from './button'

export function GoogleSignInButton() {
  return (
    <SignInButton mode="redirect" forceRedirectUrl="/" fallbackRedirectUrl="/" oauthFlow="redirect">
      <Button>Continue with Google</Button>
    </SignInButton>
  )
}

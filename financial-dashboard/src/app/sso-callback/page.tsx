'use client'

import * as React from 'react'
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { isLocalDevMockMode } from '@/lib/devMode'

export default function SsoCallbackPage() {
  if (isLocalDevMockMode) {
    return null
  }

  const redirectUrl = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return null
    }

    return new URLSearchParams(window.location.search).get('redirect_url')
  }, [])

  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={redirectUrl}
      signUpForceRedirectUrl={redirectUrl}
    />
  )
}

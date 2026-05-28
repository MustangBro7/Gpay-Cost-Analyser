'use client'

import * as React from 'react'
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { isLocalDevMockMode } from '@/lib/devMode'

export default function SsoCallbackPage() {
  const redirectUrl = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return null
    }

    return new URLSearchParams(window.location.search).get('redirect_url')
  }, [])

  if (isLocalDevMockMode) {
    return null
  }

  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={redirectUrl}
      signUpForceRedirectUrl={redirectUrl}
    />
  )
}

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'
import { isLocalDevMockMode } from '@/lib/devMode'

export default function SsoCallbackPage() {
  if (isLocalDevMockMode) {
    return null
  }

  return <AuthenticateWithRedirectCallback />
}

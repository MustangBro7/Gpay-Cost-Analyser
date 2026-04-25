import { createClerkClient } from '@clerk/backend'
import { Context } from 'hono'
import { AuthenticatedUser, Env } from '../types'
import { HttpError } from '../utils/http'

function getAuthorizedParties(env: Env): string[] {
  const configured = env.FRONTEND_ORIGINS ?? env.FRONTEND_ORIGIN
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export async function requireClerkUser(c: Context<{ Bindings: Env }>): Promise<AuthenticatedUser> {
  const clerkClient = createClerkClient({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
  })

  const requestState = await clerkClient.authenticateRequest(c.req.raw, {
    ...(c.env.CLERK_JWT_KEY ? { jwtKey: c.env.CLERK_JWT_KEY } : {}),
    authorizedParties: getAuthorizedParties(c.env),
  })

  if (!requestState.isAuthenticated) {
    throw new HttpError(401, 'Invalid or missing Clerk bearer token.')
  }

  const auth = requestState.toAuth()
  if (!auth.userId) {
    throw new HttpError(401, 'Authenticated Clerk user is missing a user id.')
  }

  const email =
    auth.sessionClaims?.email ||
    (Array.isArray(auth.sessionClaims?.email_addresses) ? auth.sessionClaims?.email_addresses[0] : null)

  return {
    clerkUserId: auth.userId,
    email: typeof email === 'string' ? email : `${auth.userId}@placeholder.local`,
  }
}

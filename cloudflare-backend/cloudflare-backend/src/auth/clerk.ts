import { createClerkClient } from '@clerk/backend'
import { Context } from 'hono'
import { AuthenticatedUser, Env } from '../types'
import { HttpError } from '../utils/http'

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

function getAuthorizedParties(env: Env): string[] {
  const configured = env.FRONTEND_ORIGINS ?? env.FRONTEND_ORIGIN
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function getClerkClient(env: Env) {
  return createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  })
}

export function parseScopeList(value?: string | string[] | null): string[] {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean)
  }
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export async function getGoogleAccountStatus(env: Env, clerkUserId: string): Promise<{
  googleEmail: string | null
  approvedScopes: string[]
  tokenScopes: string[]
  hasGoogleAccount: boolean
  hasGmailScope: boolean
}> {
  const clerkClient = getClerkClient(env)
  const user = await clerkClient.users.getUser(clerkUserId)
  const googleAccount = user.externalAccounts.find((account) => account.provider === 'google') ?? null
  const approvedScopes = parseScopeList(googleAccount?.approvedScopes ?? null)
  let tokenScopes: string[] = []

  try {
    const oauthAccessTokens = await clerkClient.users.getUserOauthAccessToken(clerkUserId, 'google')
    tokenScopes = [...new Set(oauthAccessTokens.data.flatMap((entry) => entry.scopes ?? []))]
  } catch (error) {
    console.warn('Unable to fetch Clerk Google OAuth access tokens while checking account status:', error)
  }

  const combinedScopes = new Set([...approvedScopes, ...tokenScopes])

  return {
    googleEmail: googleAccount?.emailAddress ?? null,
    approvedScopes,
    tokenScopes,
    hasGoogleAccount: Boolean(googleAccount),
    hasGmailScope: combinedScopes.has(GMAIL_READONLY_SCOPE),
  }
}

export async function getGoogleOauthAccessToken(env: Env, clerkUserId: string): Promise<{
  token: string | null
  expiresAt: number | null
  scopes: string[]
}> {
  const clerkClient = getClerkClient(env)
  try {
    const response = await clerkClient.users.getUserOauthAccessToken(clerkUserId, 'google')
    const scopedToken =
      response.data.find((entry) => (entry.scopes ?? []).includes(GMAIL_READONLY_SCOPE)) ??
      response.data[0] ??
      null

    return {
      token: scopedToken?.token ?? null,
      expiresAt: scopedToken?.expiresAt ?? null,
      scopes: scopedToken?.scopes ?? [],
    }
  } catch (error) {
    console.warn('Unable to fetch Clerk Google OAuth access token:', error)
    return {
      token: null,
      expiresAt: null,
      scopes: [],
    }
  }
}

export async function requireClerkUser(c: Context<{ Bindings: Env }>): Promise<AuthenticatedUser> {
  const clerkClient = getClerkClient(c.env)

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

import { createClerkClient } from '@clerk/backend'
import { Context } from 'hono'
import { AuthenticatedUser, Env } from '../types'
import { HttpError } from '../utils/http'

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const CLERK_GOOGLE_ACCOUNT_PROVIDERS = ['oauth_google', 'google'] as const
const CLERK_GOOGLE_TOKEN_PROVIDERS = ['oauth_google', 'google'] as const

function getAuthorizedParties(env: Env): string[] {
  const configured = env.FRONTEND_ORIGINS ?? env.FRONTEND_ORIGIN
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function isLocalDevMode(env: Pick<Env, 'LOCAL_DEV_MODE'>): boolean {
  return env.LOCAL_DEV_MODE === 'true'
}

function getLocalDevUser(env: Pick<Env, 'DEV_MOCK_USER_ID' | 'DEV_MOCK_USER_EMAIL'>): AuthenticatedUser {
  const clerkUserId = env.DEV_MOCK_USER_ID?.trim() || 'local-dev-user'
  const email = env.DEV_MOCK_USER_EMAIL?.trim() || 'local-dev@gpay.local'

  return { clerkUserId, email }
}

export function getClerkClient(env: Env) {
  return createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  })
}

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.endsWith('@placeholder.local'))
}

async function getPrimaryClerkEmail(env: Env, clerkUserId: string): Promise<string | null> {
  try {
    const clerkClient = getClerkClient(env)
    const user = await clerkClient.users.getUser(clerkUserId)
    const primaryEmail = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId) ?? user.emailAddresses[0]
    return primaryEmail?.emailAddress ?? null
  } catch (error) {
    console.warn('Unable to fetch Clerk primary email:', error)
    return null
  }
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

async function getClerkGoogleOauthAccessTokens(env: Env, clerkUserId: string) {
  const results: Array<{ token: string | null; expiresAt: number | null; scopes: string[] }> = []

  for (const provider of CLERK_GOOGLE_TOKEN_PROVIDERS) {
    try {
      const response = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}/oauth_access_tokens/${provider}`, {
        headers: {
          Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
        },
      })
      if (!response.ok) {
        throw new Error(`Clerk returned ${response.status} for provider ${provider}`)
      }

      const data = (await response.json()) as Array<{
        token?: string | null
        expires_at?: number | null
        scopes?: string[]
      }>

      for (const entry of data) {
        results.push({
          token: entry.token ?? null,
          expiresAt: entry.expires_at ?? null,
          scopes: entry.scopes ?? [],
        })
      }
    } catch (error) {
      console.warn(`Unable to fetch Clerk Google OAuth access tokens for provider ${provider}:`, error)
    }
  }

  return results
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
  const googleAccount =
    user.externalAccounts.find((account) => CLERK_GOOGLE_ACCOUNT_PROVIDERS.includes(account.provider as 'google' | 'oauth_google')) ??
    null
  const approvedScopes = parseScopeList(googleAccount?.approvedScopes ?? null)
  const oauthAccessTokens = await getClerkGoogleOauthAccessTokens(env, clerkUserId)
  const tokenScopes = [...new Set(oauthAccessTokens.flatMap((entry) => entry.scopes ?? []))]

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
  try {
    const oauthAccessTokens = await getClerkGoogleOauthAccessTokens(env, clerkUserId)
    const scopedToken =
      oauthAccessTokens.find((entry) => entry.scopes.includes(GMAIL_READONLY_SCOPE)) ??
      oauthAccessTokens[0] ??
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

  const claimEmail =
    auth.sessionClaims?.email ||
    (Array.isArray(auth.sessionClaims?.email_addresses) ? auth.sessionClaims?.email_addresses[0] : null)
  const clerkEmail =
    typeof claimEmail === 'string' && !isPlaceholderEmail(claimEmail)
      ? claimEmail
      : (await getPrimaryClerkEmail(c.env, auth.userId)) ?? null

  return {
    clerkUserId: auth.userId,
    email: typeof clerkEmail === 'string' ? clerkEmail : `${auth.userId}@placeholder.local`,
  }
}

export async function requireAuthenticatedUser(c: Context<{ Bindings: Env }>): Promise<AuthenticatedUser> {
  if (isLocalDevMode(c.env)) {
    return getLocalDevUser(c.env)
  }

  return requireClerkUser(c)
}

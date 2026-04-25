import { Env } from '../types'
import { HttpError } from '../utils/http'
import { addMinutes, nowIso } from '../utils/time'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo'
const GOOGLE_GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
]

export interface GoogleTokenExchange {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

async function parseGoogleError(response: Response): Promise<string> {
  try {
    const payload = await response.json<{ error?: string; error_description?: string }>()
    return payload.error_description || payload.error || `Google request failed with status ${response.status}.`
  } catch {
    return `Google request failed with status ${response.status}.`
  }
}

async function postForm(env: Env, body: URLSearchParams): Promise<GoogleTokenExchange> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!response.ok) {
    throw new HttpError(502, await parseGoogleError(response))
  }
  return response.json<GoogleTokenExchange>()
}

export async function exchangeCodeForTokens(env: Env, code: string): Promise<GoogleTokenExchange & { token_expiry_at: string | null; auth_timestamp: string }> {
  const authTimestamp = nowIso()
  const tokens = await postForm(
    env,
    new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    })
  )

  return {
    ...tokens,
    token_expiry_at: typeof tokens.expires_in === 'number' ? addMinutes(authTimestamp, Math.floor(tokens.expires_in / 60)) : null,
    auth_timestamp: authTimestamp,
  }
}

export async function refreshGoogleAccessToken(
  env: Env,
  refreshToken: string
): Promise<GoogleTokenExchange & { token_expiry_at: string | null; refreshed_at: string }> {
  const refreshedAt = nowIso()
  const tokens = await postForm(
    env,
    new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })
  )

  return {
    ...tokens,
    token_expiry_at: typeof tokens.expires_in === 'number' ? addMinutes(refreshedAt, Math.floor(tokens.expires_in / 60)) : null,
    refreshed_at: refreshedAt,
  }
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string }> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    throw new HttpError(502, await parseGoogleError(response))
  }
  return response.json<{ email: string }>()
}

export async function gmailRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${GOOGLE_GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const message = await parseGoogleError(response)
    throw new HttpError(response.status === 404 ? 404 : 502, message)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json<T>()
}

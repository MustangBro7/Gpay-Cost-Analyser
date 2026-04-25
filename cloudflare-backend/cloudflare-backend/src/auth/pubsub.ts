import { jwtVerify, createRemoteJWKSet } from 'jose'
import { Context } from 'hono'
import { Env } from '../types'
import { HttpError } from '../utils/http'

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export async function verifyPubSubPush(c: Context<{ Bindings: Env }>): Promise<void> {
  const authorization = c.req.header('authorization')
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    throw new HttpError(401, 'Missing Pub/Sub bearer token.')
  }

  const token = authorization.slice('Bearer '.length)
  const result = await jwtVerify(token, googleJwks, {
    audience: c.env.GOOGLE_PUBSUB_AUDIENCE,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  })

  const email = result.payload.email
  const emailVerified = result.payload.email_verified
  if (email !== c.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL || emailVerified !== true) {
    throw new HttpError(403, 'Pub/Sub push token email verification failed.')
  }
}

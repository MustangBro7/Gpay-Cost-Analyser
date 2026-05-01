import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { requireClerkUser } from './auth/clerk'
import { verifyPubSubPush } from './auth/pubsub'
import { TransactionRepository } from './repositories/transaction-repository'
import { UserRepository } from './repositories/user-repository'
import { GmailService } from './services/gmail'
import {
  AddTransactionRequest,
  DateRangeRequest,
  Env,
  GmailPushEnvelope,
  GmailPushPayload,
  NormalizeRequest,
  ReclassifyRequest,
  Transaction,
} from './types'
import { HttpError, parseJsonBody } from './utils/http'
import { addHours, isPast, nowIso } from './utils/time'

const app = new Hono<{ Bindings: Env }>()

function getAllowedOrigins(env: Env): string[] {
  const configured = env.FRONTEND_ORIGINS ?? env.FRONTEND_ORIGIN
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowedOrigins = getAllowedOrigins(c.env)
      if (!origin) {
        return c.env.FRONTEND_ORIGIN
      }
      return allowedOrigins.includes(origin) ? origin : ''
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
)

app.onError((error, c) => {
  if (error instanceof HttpError) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status,
      headers: {
        'content-type': 'application/json',
      },
    })
  }
  if (error instanceof HTTPException) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status,
      headers: {
        'content-type': 'application/json',
      },
    })
  }
  console.error(error)
  return c.json({ error: 'Internal server error.' }, 500)
})

function getRepositories(env: Env) {
  const users = new UserRepository(env.DB)
  const transactions = new TransactionRepository(env.DB, env.TRANSACTIONS_BUCKET)
  const gmail = new GmailService(env, users, transactions)
  return { users, transactions, gmail }
}

function ensureDateTime(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new HttpError(400, `${field} must be in YYYY-MM-DD HH:MM:SS format.`)
  }
  return value
}

function parseDateRange(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'Invalid date range payload.')
  }
  return parsed
}

app.get('/', (c) => c.json({ service: 'cloudflare-backend', status: 'ok' }))

app.get('/health', (c) => c.json({ status: 'ok' }))

app.post('/google/connect-url', async (c) => {
  const { users, gmail } = getRepositories(c.env)
  const authUser = await requireClerkUser(c)
  await users.upsertUser(authUser.clerkUserId, authUser.email)
  const state = await gmail.syncGoogleConnection(authUser.clerkUserId)

  if (state.authStatus === 'active') {
    await gmail.ensureWatch(authUser.clerkUserId)
    return c.json({
      status: 'already_connected',
      message: 'Google access is already available through Clerk.',
      authorizationUrl: c.env.FRONTEND_ORIGIN,
    })
  }

  const redirect = new URL(c.env.FRONTEND_ORIGIN)
  redirect.searchParams.set('reauth', 'google')
  return c.json({
    status: state.authStatus,
    authorizationUrl: redirect.toString(),
    message:
      state.authStatus === 'disconnected'
        ? 'Sign in with Google through Clerk to enable Gmail access.'
        : 'Reconnect your Google account through Clerk to grant Gmail read access.',
  })
})

app.get('/token-status', async (c) => {
  const { users, gmail } = getRepositories(c.env)
  const authUser = await requireClerkUser(c)
  const user = await users.upsertUser(authUser.clerkUserId, authUser.email)
  const state = await gmail.syncGoogleConnection(authUser.clerkUserId)

  let watch = await users.getWatchStateByClerkId(authUser.clerkUserId)
  if (
    state.authStatus === 'active' &&
    (!watch || watch.status !== 'active' || !watch.watch_expiration_at || isPast(watch.watch_expiration_at))
  ) {
    try {
      await gmail.ensureWatch(authUser.clerkUserId)
      watch = await users.getWatchStateByClerkId(authUser.clerkUserId)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const requiresReauth =
        error instanceof HttpError
          ? error.status === 401 || /reauth|oauth token|gmail readonly scope/i.test(message)
          : /reauth|oauth token|gmail readonly scope/i.test(message)

      await users.setGoogleAuthStatus(authUser.clerkUserId, {
        authStatus: requiresReauth ? 'reauth_required' : 'error',
        googleEmail: state.googleEmail,
      })
      watch = await users.getWatchStateByClerkId(authUser.clerkUserId)
    }
  }

  const freshUser = (await users.getUserByClerkId(authUser.clerkUserId)) ?? user
  if (state.authStatus === 'disconnected') {
    return c.json({
      user_id: authUser.clerkUserId,
      authenticated: false,
      auth_timestamp: null,
      expires_at: null,
      hours_remaining: 0,
      needs_reauth: true,
      message: 'Sign in with Google through Clerk to enable Gmail access.',
      google_email: null,
      auth_status: 'disconnected',
      watch_expires_at: null,
      last_sync_at: null,
      reauth_reason: state.reauthReason,
    })
  }

  const expiresAt = watch?.watch_expiration_at ?? null
  const hoursRemaining = expiresAt ? Math.max(0, (new Date(expiresAt).getTime() - Date.now()) / 3_600_000) : 0
  const needsReauth = freshUser.google_auth_status === 'reauth_required' || freshUser.google_auth_status === 'disconnected'
  return c.json({
    user_id: authUser.clerkUserId,
    authenticated: freshUser.google_auth_status === 'active',
    auth_timestamp: freshUser.google_connected_at,
    expires_at: expiresAt,
    hours_remaining: Number(hoursRemaining.toFixed(2)),
    needs_reauth: needsReauth,
    message:
      freshUser.google_auth_status === 'active'
        ? 'Google sign-in is active through Clerk.'
        : freshUser.google_auth_status === 'reauth_required'
          ? 'Reconnect Google in Clerk to grant Gmail access.'
          : freshUser.google_auth_status === 'error'
            ? 'Google access is linked, but Gmail watch setup failed.'
            : 'Google not connected',
    google_email: freshUser.google_email,
    auth_status: freshUser.google_auth_status,
    watch_expires_at: watch?.watch_expiration_at ?? null,
    last_sync_at: watch?.last_sync_at ?? null,
    reauth_reason: needsReauth ? state.reauthReason ?? watch?.last_error ?? 'manual_reauth_required' : watch?.last_error ?? null,
  })
})

app.post('/daterange', async (c) => {
  const { users, transactions } = getRepositories(c.env)
  const authUser = await requireClerkUser(c)
  await users.upsertUser(authUser.clerkUserId, authUser.email)
  const payload = await parseJsonBody<DateRangeRequest>(c.req.raw)
  const startDate = parseDateRange(payload.startDate)
  const endDate = parseDateRange(payload.endDate)
  const items = await transactions.getTransactions(authUser.clerkUserId)

  const filtered = items.filter((item) => {
    const txDate = new Date(item.Date.replace(' ', 'T'))
    return txDate >= startDate && txDate <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59)
  })
  return c.json(filtered)
})

app.post('/add-transaction', async (c) => {
  const { users, transactions } = getRepositories(c.env)
  const authUser = await requireClerkUser(c)
  await users.upsertUser(authUser.clerkUserId, authUser.email)
  const payload = await parseJsonBody<AddTransactionRequest>(c.req.raw)
  ensureDateTime(payload.Date, 'Date')

  const result = await transactions.mutateTransactions(authUser.clerkUserId, (items) => {
    const exists = items.some((entry) => entry.Date === payload.Date && entry.Amount === payload.Amount)
    if (exists) {
      throw new HttpError(400, 'A transaction with this date and amount already exists.')
    }
    const transaction: Transaction = {
      Amount: payload.Amount.replace(/,/g, ''),
      Classification: payload.Classification,
      Receiver: payload.Receiver.trim(),
      Date: payload.Date,
    }
    items.push(transaction)
    return transaction
  })

  return c.json({ status: 'created', transaction: result.result })
})

app.post('/reclassify', async (c) => {
  const { users, transactions } = getRepositories(c.env)
  const authUser = await requireClerkUser(c)
  await users.upsertUser(authUser.clerkUserId, authUser.email)
  const payload = await parseJsonBody<ReclassifyRequest>(c.req.raw)

  const result = await transactions.mutateTransactions(authUser.clerkUserId, (items) => {
    const match = items.find((entry) => entry.Date === payload.original.Date)
    if (!match) {
      throw new HttpError(404, 'Transaction not found.')
    }
    match.Classification = payload.newClassification
    return match
  })

  return c.json({ status: 'updated', data: result.transactions, updated_transaction: result.result })
})

app.post('/normalize', async (c) => {
  const { users, transactions } = getRepositories(c.env)
  const authUser = await requireClerkUser(c)
  await users.upsertUser(authUser.clerkUserId, authUser.email)
  const payload = await parseJsonBody<NormalizeRequest>(c.req.raw)

  const result = await transactions.mutateTransactions(authUser.clerkUserId, (items) => {
    const tx = items.find((entry) => entry.Date === payload.original.Date)
    if (!tx) {
      throw new HttpError(404, 'Transaction not found.')
    }

    const validPayers = (payload.payers ?? []).filter((payer) => payer.name.trim() && payer.amount.trim())
    const paidToMeTotal = validPayers.reduce((sum, payer) => sum + (parseFloat(payer.amount.replace(/,/g, '')) || 0), 0)

    if (paidToMeTotal > 0) {
      const originalAmount =
        parseFloat((tx.OriginalAmount ?? payload.original.OriginalAmount ?? String((parseFloat(tx.Amount) || 0) + (parseFloat(tx.PaidToMe ?? '0') || 0))).replace(/,/g, '')) || 0
      tx.OriginalAmount = String(originalAmount)
      tx.PaidToMe = String(paidToMeTotal)
      tx.Payers = validPayers
      const netAmount = originalAmount - paidToMeTotal
      tx.Amount = Number.isInteger(netAmount) ? `${netAmount}` : netAmount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    } else {
      tx.PaidToMe = undefined
      tx.Payers = undefined
      if (tx.OriginalAmount) {
        tx.Amount = tx.OriginalAmount
      }
      tx.OriginalAmount = undefined
    }

    return tx
  })

  return c.json({ status: 'updated', data: result.transactions, updated_transaction: result.result })
})

app.post('/internal/pubsub/gmail', async (c) => {
  await verifyPubSubPush(c)
  const { users, gmail } = getRepositories(c.env)
  const envelope = await parseJsonBody<GmailPushEnvelope>(c.req.raw)
  if (!envelope.message?.data || !envelope.message?.messageId) {
    throw new HttpError(400, 'Invalid Pub/Sub envelope.')
  }

  const payload = JSON.parse(atob(envelope.message.data)) as GmailPushPayload
  const result = await gmail.processPush(payload)
  await users.recordDelivery(envelope.message.messageId, payload.emailAddress, payload.historyId)
  return c.json({ status: 'processed', ...result })
})

async function runDailyMaintenance(env: Env): Promise<void> {
  const { users, gmail } = getRepositories(env)
  const expiringSoon = addHours(nowIso(), 48)
  const candidates = await users.listUsersForWatchRenewal(expiringSoon)
  for (const candidate of candidates) {
    try {
      await gmail.createWatch(candidate.clerk_user_id)
      await users.setGoogleAuthStatus(candidate.clerk_user_id, { authStatus: 'active' })
    } catch (error) {
      await users.setGoogleAuthStatus(candidate.clerk_user_id, {
        authStatus: /reauth/i.test(error instanceof Error ? error.message : '') ? 'reauth_required' : 'error',
      })
      const watch = await users.getWatchStateByClerkId(candidate.clerk_user_id)
      await users.saveWatchState(candidate.clerk_user_id, {
        googleEmail: watch?.google_email ?? candidate.google_email ?? candidate.clerk_email,
        topicName: watch?.topic_name ?? env.GOOGLE_PUBSUB_TOPIC_NAME,
        lastHistoryId: watch?.last_history_id ?? null,
        watchExpirationAt: watch?.watch_expiration_at ?? null,
        status: 'error',
        lastRenewalAt: watch?.last_renewal_at ?? null,
        lastSyncAt: watch?.last_sync_at ?? null,
        lastNotificationAt: watch?.last_notification_at ?? null,
        lastError: error instanceof Error ? error.message : 'Failed to renew Gmail watch.',
      })
    }
  }
}

async function runHourlyRecovery(env: Env): Promise<void> {
  const { users, gmail } = getRepositories(env)
  const candidates = await users.listUsersInErrorState()
  for (const candidate of candidates) {
    try {
      await gmail.createWatch(candidate.clerk_user_id)
      await users.setGoogleAuthStatus(candidate.clerk_user_id, { authStatus: 'active' })
    } catch (error) {
      await users.setGoogleAuthStatus(candidate.clerk_user_id, {
        authStatus: /reauth|refresh token/i.test(error instanceof Error ? error.message : '') ? 'reauth_required' : 'error',
      })
    }
  }
}

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env) => {
    if (event.cron === '0 * * * *') {
      await runHourlyRecovery(env)
      return
    }
    await runDailyMaintenance(env)
  },
}

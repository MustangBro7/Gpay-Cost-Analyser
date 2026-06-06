import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { isLocalDevMode, requireAuthenticatedUser } from './auth/clerk'
import {
  addDevTransaction,
  getDevClassificationSettings,
  getDevTokenStatus,
  getDevTransactions,
  normalizeDevTransaction,
  reclassifyDevTransaction,
  upsertDevClassificationSettings,
} from './dev/mock-data'
import { verifyPubSubPush } from './auth/pubsub'
import { AiAgentEvalRepository } from './repositories/ai-agent-eval-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { UserRepository } from './repositories/user-repository'
import { extractAndClassifyTransaction } from './services/classifier'
import { GmailService } from './services/gmail'
import { normalizeClassificationSettingsInput } from './services/classification-settings'
import {
  AddTransactionRequest,
  ClassificationPreviewRequest,
  DateRangeRequest,
  Env,
  GmailPushEnvelope,
  GmailPushPayload,
  UpdateClassificationSettingsRequest,
  NormalizeRequest,
  ReclassifyRequest,
  Transaction,
  UserRole,
} from './types'
import { encodeBase64Url } from './utils/base64'
import { parseGmailMessage } from './utils/email'
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
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
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
  const aiAgentEvals = new AiAgentEvalRepository(env.DB)
  const transactions = new TransactionRepository(env.DB, env.TRANSACTIONS_BUCKET)
  const gmail = new GmailService(env, users, transactions)
  return { users, aiAgentEvals, transactions, gmail }
}

function parseConfiguredValues(value?: string): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )
}

function resolveRequestedUserRole(env: Env, clerkUserId: string, email: string): UserRole | null {
  if (isLocalDevMode(env)) {
    return env.DEV_MOCK_USER_ROLE ?? 'admin'
  }

  const adminEmails = parseConfiguredValues(env.ADMIN_EMAILS)
  if (adminEmails.has(email.trim().toLowerCase())) {
    return 'admin'
  }

  return null
}

async function upsertAuthenticatedUser(env: Env, users: UserRepository, authUser: { clerkUserId: string; email: string }) {
  return users.upsertUser(
    authUser.clerkUserId,
    authUser.email,
    resolveRequestedUserRole(env, authUser.clerkUserId, authUser.email)
  )
}

async function requireAdminUser(c: Parameters<typeof requireAuthenticatedUser>[0], users: UserRepository) {
  const authUser = await requireAuthenticatedUser(c)
  const user = await upsertAuthenticatedUser(c.env, users, authUser)
  if (user.role !== 'admin') {
    throw new HttpError(403, 'Admin access is required.')
  }
  return { authUser, user }
}

function parsePaginationValue(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }
  return Math.min(parsed, max)
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

function filterTransactionsByDate(items: Transaction[], startDate: Date, endDate: Date): Transaction[] {
  return items.filter((item) => {
    const txDate = new Date(item.Date.replace(' ', 'T'))
    return txDate >= startDate && txDate <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59)
  })
}

function formatPreviewEmailDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) \d{2}:\d{2}:\d{2}$/)
  if (!match) {
    throw new HttpError(400, 'Date must be in YYYY-MM-DD HH:MM:SS format.')
  }

  return `${match[3]}-${match[2]}-${match[1].slice(-2)}`
}

function formatPreviewDateHeader(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) {
    throw new HttpError(400, 'Date must be in YYYY-MM-DD HH:MM:SS format.')
  }

  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+05:30`
  const parsed = new Date(iso)
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const weekday = weekdays[parsed.getUTCDay()]
  const day = `${parsed.getUTCDate()}`.padStart(2, '0')
  const month = months[parsed.getUTCMonth()]
  const year = parsed.getUTCFullYear()

  return `${weekday}, ${day} ${month} ${year} ${match[4]}:${match[5]}:${match[6]} +0530`
}

function buildClassificationPreviewEmail(payload: ClassificationPreviewRequest): string {
  return `Dear Customer,

Greetings from HDFC Bank!

Rs.${payload.Amount}.00 is debited from your account ending 0230 towards VPA 9535634091@kotak811 (${payload.Receiver}) on ${formatPreviewEmailDate(payload.Date)}.

UPI transaction reference no.: 651347891893.

If you did not authorize this transaction, please report it immediately at:
a. When in India (Toll free): 1800 258 6161
b. When abroad: 9122 61606160
c. Or SMS 'BLOCK UPI' to 7308080808.

We're here to support you in every step of the way.

Warm regards,
HDFC Bank`
}

function buildClassificationPreviewMessage(payload: ClassificationPreviewRequest) {
  const bodyText = buildClassificationPreviewEmail(payload)

  return parseGmailMessage({
    id: 'preview-message',
    threadId: 'preview-thread',
    payload: {
      headers: [
        { name: 'From', value: 'HDFC Bank <alerts@hdfcbank.net>' },
        { name: 'Subject', value: 'Debit Alert' },
        { name: 'Date', value: formatPreviewDateHeader(payload.Date) },
      ],
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: encodeBase64Url(bodyText),
          },
        },
      ],
    },
  })
}

async function seedLocalAiEvalTraces(env: Env, authUser: { clerkUserId: string; email: string }) {
  const samples = [
    {
      source: 'gmail' as const,
      body: `Dear Customer,

Greetings from HDFC Bank!

Rs.306.00 is debited from your account ending 0230 towards VPA blinkit@axisbank (Blinkit) on 28-04-26.

UPI transaction reference no.: 651347891893.

Warm regards,
HDFC Bank`,
      sentAt: '2026-04-28 16:42:18',
      gmailMessageId: 'local-seed-gmail-001',
      gmailThreadId: 'local-seed-thread-001',
    },
    {
      source: 'gmail' as const,
      body: `Dear Customer,

Greetings from HDFC Bank!

Rs.25.00 is debited from your account ending 0230 towards VPA bmtc@okicici (BMTC BUS KA57F1288) on 27-04-26.

UPI transaction reference no.: 651347891894.

Warm regards,
HDFC Bank`,
      sentAt: '2026-04-27 02:46:22',
      gmailMessageId: 'local-seed-gmail-002',
      gmailThreadId: 'local-seed-thread-002',
    },
    {
      source: 'preview' as const,
      body: buildClassificationPreviewEmail({
        Amount: '420',
        Receiver: 'PRAKASH B R',
        Date: '2026-04-26 15:24:45',
      }),
      sentAt: '2026-04-26 15:24:45',
      gmailMessageId: null,
      gmailThreadId: null,
    },
  ]

  const settings = isLocalDevMode(env)
    ? getDevClassificationSettings(authUser)
    : getRepositories(env).users.getResolvedClassificationSettings(authUser.clerkUserId)

  const classificationSettings = await Promise.resolve(settings)

  for (const sample of samples) {
    await extractAndClassifyTransaction(env, sample.body, sample.sentAt, classificationSettings, {
      clerkUserId: authUser.clerkUserId,
      clerkEmail: authUser.email,
      source: sample.source,
      gmailMessageId: sample.gmailMessageId,
      gmailThreadId: sample.gmailThreadId,
    })
  }

  return samples.length
}

app.get('/', (c) => c.json({ service: 'cloudflare-backend', status: 'ok' }))

app.get('/health', (c) => c.json({ status: 'ok' }))

app.post('/google/connect-url', async (c) => {
  if (isLocalDevMode(c.env)) {
    return c.json({
      status: 'active',
      message: 'Local dev mock mode is active.',
      authorizationUrl: c.env.FRONTEND_ORIGIN,
    })
  }

  const { users, gmail } = getRepositories(c.env)
  const authUser = await requireAuthenticatedUser(c)
  await upsertAuthenticatedUser(c.env, users, authUser)
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
  const authUser = await requireAuthenticatedUser(c)
  if (isLocalDevMode(c.env)) {
    return c.json(getDevTokenStatus(authUser))
  }

  const { users, gmail } = getRepositories(c.env)
  const user = await upsertAuthenticatedUser(c.env, users, authUser)
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
      role: user.role,
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
    role: freshUser.role,
    auth_status: freshUser.google_auth_status,
    watch_expires_at: watch?.watch_expiration_at ?? null,
    last_sync_at: watch?.last_sync_at ?? null,
    reauth_reason: needsReauth ? state.reauthReason ?? watch?.last_error ?? 'manual_reauth_required' : watch?.last_error ?? null,
  })
})

app.get('/admin/ai-evals', async (c) => {
  const { users, aiAgentEvals } = getRepositories(c.env)
  await requireAdminUser(c, users)

  const limit = parsePaginationValue(c.req.query('limit'), 25, 100)
  const offset = parsePaginationValue(c.req.query('offset'), 0, 10_000)
  const statusValue = c.req.query('status')
  const status = statusValue === 'success' || statusValue === 'error' || statusValue === 'skipped' ? statusValue : null
  const query = c.req.query('query') ?? null

  const { items, total } = await aiAgentEvals.list({
    limit,
    offset,
    status,
    query,
  })

  return c.json({
    items,
    pagination: {
      limit,
      offset,
      total,
      has_more: offset + items.length < total,
    },
  })
})

app.post('/admin/dev/seed-ai-evals', async (c) => {
  if (!isLocalDevMode(c.env)) {
    throw new HttpError(404, 'Not found.')
  }

  const { users } = getRepositories(c.env)
  const { authUser } = await requireAdminUser(c, users)
  const created = await seedLocalAiEvalTraces(c.env, authUser)

  return c.json({
    status: 'ok',
    created,
    message: 'Seeded local AI eval traces using the production classification flow.',
  })
})

app.get('/classification-settings', async (c) => {
  const authUser = await requireAuthenticatedUser(c)

  if (isLocalDevMode(c.env)) {
    return c.json(getDevClassificationSettings(authUser))
  }

  const { users } = getRepositories(c.env)
  await upsertAuthenticatedUser(c.env, users, authUser)
  return c.json(await users.getResolvedClassificationSettings(authUser.clerkUserId))
})

app.put('/classification-settings', async (c) => {
  const authUser = await requireAuthenticatedUser(c)
  const payload = normalizeClassificationSettingsInput(
    await parseJsonBody<UpdateClassificationSettingsRequest>(c.req.raw)
  )

  if (isLocalDevMode(c.env)) {
    return c.json(upsertDevClassificationSettings(authUser, payload))
  }

  const { users } = getRepositories(c.env)
  await upsertAuthenticatedUser(c.env, users, authUser)
  await users.upsertClassificationSettings(authUser.clerkUserId, payload)
  return c.json(await users.getResolvedClassificationSettings(authUser.clerkUserId))
})

app.post('/classification-preview', async (c) => {
  if (!isLocalDevMode(c.env)) {
    throw new HttpError(404, 'Not found.')
  }

  const authUser = await requireAuthenticatedUser(c)
  const payload = await parseJsonBody<ClassificationPreviewRequest>(c.req.raw)

  if (!payload.Amount?.trim()) {
    throw new HttpError(400, 'Amount is required.')
  }
  if (!payload.Receiver?.trim()) {
    throw new HttpError(400, 'Receiver is required.')
  }
  ensureDateTime(payload.Date, 'Date')

  const classificationSettings = getDevClassificationSettings(authUser)

  const previewMessage = buildClassificationPreviewMessage({
    Amount: payload.Amount.replace(/,/g, ''),
    Receiver: payload.Receiver.trim(),
    Date: payload.Date,
  })

  if (!previewMessage.from.toLowerCase().includes('alerts@hdfcbank.net')) {
    throw new HttpError(500, 'Preview sender did not match HDFC sender filter.')
  }
  if (!previewMessage.bodyText.toLowerCase().includes('debited') && !previewMessage.bodyText.toLowerCase().includes('is debited')) {
    throw new HttpError(500, 'Preview body did not match debit message filter.')
  }

  const transaction = await extractAndClassifyTransaction(
    c.env,
    previewMessage.bodyText,
    previewMessage.sentAt,
    classificationSettings,
    {
      clerkUserId: authUser.clerkUserId,
      clerkEmail: authUser.email,
      source: 'preview',
    }
  )
  if (!transaction) {
    throw new HttpError(500, 'Failed to classify preview transaction.')
  }

  return c.json({
    status: 'ok',
    input: {
      Amount: payload.Amount.replace(/,/g, ''),
      Receiver: payload.Receiver.trim(),
      Date: payload.Date,
    },
    transaction,
    preview_message: {
      from: previewMessage.from,
      subject: previewMessage.subject,
      sentAt: previewMessage.sentAt,
      bodyText: previewMessage.bodyText,
    },
    used_custom_rules: !classificationSettings.usesDefault,
    model_enabled: Boolean(c.env.GEMINI_API_KEY),
  })
})

app.post('/daterange', async (c) => {
  const authUser = await requireAuthenticatedUser(c)
  const payload = await parseJsonBody<DateRangeRequest>(c.req.raw)
  const startDate = parseDateRange(payload.startDate)
  const endDate = parseDateRange(payload.endDate)

  if (isLocalDevMode(c.env)) {
    return c.json(filterTransactionsByDate(getDevTransactions(), startDate, endDate))
  }

  const { users, transactions } = getRepositories(c.env)
  await upsertAuthenticatedUser(c.env, users, authUser)
  const items = await transactions.getTransactions(authUser.clerkUserId)
  return c.json(filterTransactionsByDate(items, startDate, endDate))
})

app.post('/add-transaction', async (c) => {
  const authUser = await requireAuthenticatedUser(c)
  const payload = await parseJsonBody<AddTransactionRequest>(c.req.raw)
  ensureDateTime(payload.Date, 'Date')

  if (isLocalDevMode(c.env)) {
    const transaction = addDevTransaction(payload)
    return c.json({ status: 'created', transaction })
  }

  const { users, transactions } = getRepositories(c.env)
  await upsertAuthenticatedUser(c.env, users, authUser)

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
  const authUser = await requireAuthenticatedUser(c)
  const payload = await parseJsonBody<ReclassifyRequest>(c.req.raw)

  if (isLocalDevMode(c.env)) {
    const result = reclassifyDevTransaction(payload)
    return c.json({ status: 'updated', data: result.transactions, updated_transaction: result.updatedTransaction })
  }

  const { users, transactions } = getRepositories(c.env)
  await upsertAuthenticatedUser(c.env, users, authUser)

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
  const authUser = await requireAuthenticatedUser(c)
  const payload = await parseJsonBody<NormalizeRequest>(c.req.raw)

  if (isLocalDevMode(c.env)) {
    const result = normalizeDevTransaction(payload)
    return c.json({ status: 'updated', data: result.transactions, updated_transaction: result.updatedTransaction })
  }

  const { users, transactions } = getRepositories(c.env)
  await upsertAuthenticatedUser(c.env, users, authUser)

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

  c.executionCtx.waitUntil(
    (async () => {
      if (await users.hasProcessedDelivery(envelope.message.messageId)) {
        return
      }

      await users.recordDelivery(envelope.message.messageId, payload.emailAddress, payload.historyId)
      await gmail.processPush(payload)
    })().catch((error) => {
      console.error('Failed to process Gmail Pub/Sub notification.', {
        messageId: envelope.message.messageId,
        emailAddress: payload.emailAddress,
        historyId: payload.historyId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  )

  return c.json({ status: 'accepted', processedMessages: 0 })
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
    if (isLocalDevMode(env)) {
      return
    }

    if (event.cron === '0 * * * *') {
      await runHourlyRecovery(env)
      return
    }
    await runDailyMaintenance(env)
  },
}

import { Env, GmailPushPayload, ParsedEmailMessage, Transaction } from '../types'
import { UserRepository } from '../repositories/user-repository'
import { TransactionRepository } from '../repositories/transaction-repository'
import { extractAndClassifyTransaction } from './classifier'
import { fetchGoogleUserInfo, gmailRequest, refreshGoogleAccessToken } from './google'
import { parseGmailMessage } from '../utils/email'
import { HttpError } from '../utils/http'
import { addHours, isPast, nowIso } from '../utils/time'

type GmailHistoryResponse = {
  history?: Array<{
    id?: string
    messages?: Array<{ id?: string }>
    messagesAdded?: Array<{ message?: { id?: string } }>
  }>
  historyId?: string
  nextPageToken?: string
}

type GmailListMessagesResponse = {
  messages?: Array<{ id: string }>
  nextPageToken?: string
}

type GmailMessagePart = {
  headers?: Array<{ name: string; value: string }>
  mimeType?: string
  body?: { data?: string }
  parts?: GmailMessagePart[]
}

type GmailMessageResponse = {
  id: string
  threadId: string
  payload?: GmailMessagePart
}

export class GmailService {
  private readonly senders: string[]

  constructor(
    private readonly env: Env,
    private readonly users: UserRepository,
    private readonly transactions: TransactionRepository
  ) {
    this.senders = (env.HDFC_SENDERS || 'alerts@hdfcbank.net,alerts@hdfcbank.bank.in')
      .split(',')
      .map((sender) => sender.trim().toLowerCase())
      .filter(Boolean)
  }

  async getValidAccessToken(clerkUserId: string): Promise<{ accessToken: string; googleEmail: string }> {
    const user = await this.users.getUserByClerkId(clerkUserId)
    if (!user) {
      throw new HttpError(404, 'User not found.')
    }

    const tokenRecord = await this.users.getGoogleTokens(clerkUserId)
    if (!tokenRecord) {
      throw new HttpError(404, 'Google account not connected.')
    }

    if (!isPast(tokenRecord.token_expiry_at)) {
      if (!user.google_email) {
        const userInfo = await fetchGoogleUserInfo(tokenRecord.access_token)
        await this.users.setGoogleAuthStatus(clerkUserId, {
          authStatus: 'active',
          googleEmail: userInfo.email,
          googleConnectedAt: user.google_connected_at ?? tokenRecord.auth_timestamp,
        })
        return { accessToken: tokenRecord.access_token, googleEmail: userInfo.email }
      }
      return { accessToken: tokenRecord.access_token, googleEmail: user.google_email }
    }

    if (!tokenRecord.refresh_token) {
      await this.users.setGoogleAuthStatus(clerkUserId, {
        authStatus: 'reauth_required',
      })
      throw new HttpError(401, 'Google refresh token is missing. Re-authentication required.')
    }

    try {
      const refreshed = await refreshGoogleAccessToken(this.env, tokenRecord.refresh_token)
      const accessToken = refreshed.access_token
      const googleEmail = user.google_email ?? (await fetchGoogleUserInfo(accessToken)).email

      await this.users.saveGoogleTokens(clerkUserId, {
        accessToken,
        refreshToken: tokenRecord.refresh_token,
        tokenExpiryAt: refreshed.token_expiry_at,
        scopes: JSON.parse(tokenRecord.scopes_json) as string[],
        authTimestamp: tokenRecord.auth_timestamp,
        lastRefreshAt: refreshed.refreshed_at,
        lastRefreshError: null,
      })
      await this.users.setGoogleAuthStatus(clerkUserId, {
        authStatus: 'active',
        googleEmail,
        googleConnectedAt: user.google_connected_at ?? tokenRecord.auth_timestamp,
      })
      return { accessToken, googleEmail }
    } catch (error) {
      await this.users.saveGoogleTokens(clerkUserId, {
        accessToken: tokenRecord.access_token,
        refreshToken: tokenRecord.refresh_token,
        tokenExpiryAt: tokenRecord.token_expiry_at,
        scopes: JSON.parse(tokenRecord.scopes_json) as string[],
        authTimestamp: tokenRecord.auth_timestamp,
        lastRefreshAt: tokenRecord.last_refresh_at,
        lastRefreshError: error instanceof Error ? error.message : 'Failed to refresh access token.',
      })
      await this.users.setGoogleAuthStatus(clerkUserId, {
        authStatus: 'reauth_required',
      })
      throw error
    }
  }

  async createWatch(clerkUserId: string): Promise<{ historyId: string | null; expiration: string | null }> {
    const { accessToken, googleEmail } = await this.getValidAccessToken(clerkUserId)
    const response = await gmailRequest<{ historyId?: string; expiration?: string }>(accessToken, '/users/me/watch', {
      method: 'POST',
      body: JSON.stringify({
        topicName: this.env.GOOGLE_PUBSUB_TOPIC_NAME,
        labelIds: ['INBOX'],
        labelFilterAction: 'include',
      }),
    })

    const expiration = response.expiration ? new Date(Number(response.expiration)).toISOString() : addHours(nowIso(), 24 * 7)
    await this.users.saveWatchState(clerkUserId, {
      googleEmail,
      topicName: this.env.GOOGLE_PUBSUB_TOPIC_NAME,
      lastHistoryId: response.historyId ?? null,
      watchExpirationAt: expiration,
      status: 'active',
      lastRenewalAt: nowIso(),
      lastError: null,
    })
    return { historyId: response.historyId ?? null, expiration }
  }

  async processPush(payload: GmailPushPayload): Promise<{ processedMessages: number }> {
    const user = await this.users.getUserByGoogleEmail(payload.emailAddress)
    if (!user) {
      return { processedMessages: 0 }
    }

    await this.users.markWatchNotification(user.clerk_user_id, payload.historyId)

    const watch = await this.users.getWatchStateByClerkId(user.clerk_user_id)
    const startHistoryId = watch?.last_history_id || payload.historyId

    try {
      const messageIds = await this.collectChangedMessageIds(user.clerk_user_id, startHistoryId)
      let processedMessages = 0
      for (const messageId of messageIds) {
        const processed = await this.processMessage(user.clerk_user_id, messageId)
        if (processed) {
          processedMessages += 1
        }
      }
      await this.users.markWatchSync(user.clerk_user_id, payload.historyId, 'active', null)
      return { processedMessages }
    } catch (error) {
      const shouldRecover = error instanceof HttpError && /history/i.test(error.message)
      if (!shouldRecover) {
        await this.users.markWatchSync(
          user.clerk_user_id,
          watch?.last_history_id ?? payload.historyId,
          'error',
          error instanceof Error ? error.message : 'Failed to process Gmail push notification.'
        )
        throw error
      }

      const processedMessages = await this.backfillRecentMessages(user.clerk_user_id)
      const renewed = await this.createWatch(user.clerk_user_id)
      await this.users.markWatchSync(user.clerk_user_id, renewed.historyId ?? payload.historyId, 'active', null)
      return { processedMessages }
    }
  }

  async collectChangedMessageIds(clerkUserId: string, startHistoryId: string): Promise<string[]> {
    const { accessToken } = await this.getValidAccessToken(clerkUserId)
    const ids = new Set<string>()
    let pageToken: string | undefined

    do {
      const params = new URLSearchParams({
        startHistoryId,
        historyTypes: 'messageAdded',
      })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }
      const response = await gmailRequest<GmailHistoryResponse>(
        accessToken,
        `/users/me/history?${params.toString()}`
      )

      for (const historyItem of response.history ?? []) {
        for (const entry of historyItem.messagesAdded ?? []) {
          if (entry.message?.id) {
            ids.add(entry.message.id)
          }
        }
        for (const entry of historyItem.messages ?? []) {
          if (entry.id) {
            ids.add(entry.id)
          }
        }
      }

      pageToken = response.nextPageToken
    } while (pageToken)

    return [...ids]
  }

  async backfillRecentMessages(clerkUserId: string): Promise<number> {
    const { accessToken } = await this.getValidAccessToken(clerkUserId)
    const query = this.senders.map((sender) => `from:${sender}`).join(' OR ')
    let pageToken: string | undefined
    let processed = 0
    let inspected = 0

    do {
      const params = new URLSearchParams({
        q: `(${query}) newer_than:30d`,
        maxResults: '25',
      })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }
      const response = await gmailRequest<GmailListMessagesResponse>(
        accessToken,
        `/users/me/messages?${params.toString()}`
      )

      for (const entry of response.messages ?? []) {
        if (inspected >= 50) {
          break
        }
        inspected += 1
        if (await this.processMessage(clerkUserId, entry.id)) {
          processed += 1
        }
      }

      if (inspected >= 50) {
        break
      }
      pageToken = response.nextPageToken
    } while (pageToken)

    return processed
  }

  private async processMessage(clerkUserId: string, messageId: string): Promise<boolean> {
    if (await this.users.hasProcessedMessage(clerkUserId, messageId)) {
      return false
    }

    const { accessToken } = await this.getValidAccessToken(clerkUserId)
    const response = await gmailRequest<GmailMessageResponse>(
      accessToken,
      `/users/me/messages/${encodeURIComponent(messageId)}?format=full`
    )
    const message = parseGmailMessage(response)

    if (!this.matchesSender(message)) {
      return false
    }
    if (!message.bodyText.toLowerCase().includes('debited')) {
      return false
    }

    const transaction = await extractAndClassifyTransaction(this.env, message.bodyText, message.sentAt)
    if (!transaction) {
      return false
    }

    const appended = await this.appendTransaction(clerkUserId, transaction)
    if (!appended) {
      await this.users.recordProcessedMessage(clerkUserId, message.id, message.threadId)
      return false
    }

    await this.users.recordProcessedMessage(clerkUserId, message.id, message.threadId)
    return true
  }

  private matchesSender(message: ParsedEmailMessage): boolean {
    const sender = message.from.toLowerCase()
    return this.senders.some((allowed) => sender.includes(allowed))
  }

  private async appendTransaction(clerkUserId: string, transaction: Transaction): Promise<boolean> {
    const result = await this.transactions.mutateTransactions(clerkUserId, (items) => {
      const exists = items.some(
        (entry) => entry.Date === transaction.Date && entry.Amount === transaction.Amount && entry.Receiver === transaction.Receiver
      )
      if (exists) {
        return false
      }
      items.push(transaction)
      return true
    })
    return result.result
  }
}

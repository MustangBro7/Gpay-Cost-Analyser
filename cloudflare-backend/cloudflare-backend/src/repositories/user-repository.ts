import {
  ClassificationSettings,
  ClassificationSettingsRecord,
  AuthStatus,
  ClerkUserRecord,
  GmailWatchStateRecord,
  GoogleTokenRecord,
  OAuthStateRecord,
  UserRole,
  WatchStatus,
} from '../types'
import { resolveClassificationSettings, serializeCategories } from '../services/classification-settings'
import { nowIso } from '../utils/time'

function normalizeRow<T>(row: unknown): T | null {
  if (!row) {
    return null
  }
  if (typeof row === 'object' && row !== null && 'results' in row) {
    const resultSet = row as { results?: unknown[] }
    return (resultSet.results?.[0] as T | undefined) ?? null
  }
  return row as T
}

export class UserRepository {
  constructor(private readonly db: D1Database) {}

  async upsertUser(clerkUserId: string, clerkEmail: string, role?: UserRole | null): Promise<ClerkUserRecord> {
    const timestamp = nowIso()
    await this.db
      .prepare(
        `INSERT INTO users (
          clerk_user_id,
          clerk_email,
          role,
          google_auth_status,
          created_at,
          updated_at
        ) VALUES (?, ?, COALESCE(?, 'user'), 'disconnected', ?, ?)
        ON CONFLICT(clerk_user_id) DO UPDATE SET
          clerk_email = excluded.clerk_email,
          role = COALESCE(?, users.role),
          updated_at = excluded.updated_at
        WHERE users.clerk_email IS NOT excluded.clerk_email
           OR (? IS NOT NULL AND users.role IS NOT ?)`
      )
      .bind(clerkUserId, clerkEmail, role ?? null, timestamp, timestamp, role ?? null, role ?? null, role ?? null)
      .run()

    const user = await this.getUserByClerkId(clerkUserId)
    if (!user) {
      throw new Error('Failed to upsert user.')
    }
    return user
  }

  async getUserByClerkId(clerkUserId: string): Promise<ClerkUserRecord | null> {
    const result = await this.db.prepare('SELECT * FROM users WHERE clerk_user_id = ?').bind(clerkUserId).first()
    return normalizeRow<ClerkUserRecord>(result)
  }

  async getUserByGoogleEmail(googleEmail: string): Promise<ClerkUserRecord | null> {
    const result = await this.db.prepare('SELECT * FROM users WHERE google_email = ?').bind(googleEmail).first()
    return normalizeRow<ClerkUserRecord>(result)
  }

  async getClassificationSettings(clerkUserId: string): Promise<ClassificationSettingsRecord | null> {
    const result = await this.db
      .prepare('SELECT * FROM user_classification_settings WHERE clerk_user_id = ?')
      .bind(clerkUserId)
      .first()
    return normalizeRow<ClassificationSettingsRecord>(result)
  }

  async upsertClassificationSettings(
    clerkUserId: string,
    payload: {
      categories: string[]
      rulesText: string
    }
  ): Promise<ClassificationSettingsRecord> {
    const existing = await this.getClassificationSettings(clerkUserId)
    const timestamp = nowIso()

    await this.db
      .prepare(
        `INSERT INTO user_classification_settings (
          clerk_user_id,
          categories_json,
          rules_text,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(clerk_user_id) DO UPDATE SET
          categories_json = excluded.categories_json,
          rules_text = excluded.rules_text,
          updated_at = excluded.updated_at`
      )
      .bind(
        clerkUserId,
        serializeCategories(payload.categories),
        payload.rulesText,
        existing?.created_at ?? timestamp,
        timestamp
      )
      .run()

    const settings = await this.getClassificationSettings(clerkUserId)
    if (!settings) {
      throw new Error('Failed to persist classification settings.')
    }

    return settings
  }

  async getResolvedClassificationSettings(clerkUserId: string): Promise<ClassificationSettings> {
    const record = await this.getClassificationSettings(clerkUserId)
    return resolveClassificationSettings(record)
  }

  async setGoogleAuthStatus(
    clerkUserId: string,
    updates: {
      googleEmail?: string | null
      authStatus: AuthStatus
      googleConnectedAt?: string | null
    }
  ): Promise<void> {
    if (updates.googleEmail) {
      await this.db
        .prepare(
          `UPDATE users
           SET google_email = NULL,
               updated_at = ?
           WHERE google_email = ?
             AND clerk_user_id != ?`
        )
        .bind(nowIso(), updates.googleEmail, clerkUserId)
        .run()
    }

    await this.db
      .prepare(
        `UPDATE users
         SET google_email = COALESCE(?, google_email),
             google_auth_status = ?,
             google_connected_at = COALESCE(?, google_connected_at),
             updated_at = ?
         WHERE clerk_user_id = ?
           AND (
             google_email IS NOT COALESCE(?, google_email)
             OR google_auth_status IS NOT ?
             OR google_connected_at IS NOT COALESCE(?, google_connected_at)
           )`
      )
      .bind(
        updates.googleEmail ?? null,
        updates.authStatus,
        updates.googleConnectedAt ?? null,
        nowIso(),
        clerkUserId,
        updates.googleEmail ?? null,
        updates.authStatus,
        updates.googleConnectedAt ?? null
      )
      .run()
  }

  async saveOAuthState(state: string, clerkUserId: string, expiresAt: string): Promise<void> {
    const timestamp = nowIso()
    await this.db
      .prepare(
        `INSERT INTO oauth_states (state, clerk_user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(state, clerkUserId, expiresAt, timestamp)
      .run()
  }

  async consumeOAuthState(state: string): Promise<OAuthStateRecord | null> {
    const record = normalizeRow<OAuthStateRecord>(
      await this.db.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first()
    )
    if (!record || record.used_at) {
      return null
    }

    await this.db.prepare('UPDATE oauth_states SET used_at = ? WHERE state = ?').bind(nowIso(), state).run()
    return record
  }

  async saveGoogleTokens(
    clerkUserId: string,
    payload: {
      accessToken: string
      refreshToken: string | null
      tokenExpiryAt: string | null
      scopes: string[]
      authTimestamp: string
      lastRefreshAt?: string | null
      lastRefreshError?: string | null
    }
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO google_oauth_tokens (
          clerk_user_id,
          access_token,
          refresh_token,
          token_expiry_at,
          scopes_json,
          auth_timestamp,
          last_refresh_at,
          last_refresh_error,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(clerk_user_id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = COALESCE(excluded.refresh_token, google_oauth_tokens.refresh_token),
          token_expiry_at = excluded.token_expiry_at,
          scopes_json = excluded.scopes_json,
          auth_timestamp = excluded.auth_timestamp,
          last_refresh_at = excluded.last_refresh_at,
          last_refresh_error = excluded.last_refresh_error,
          updated_at = excluded.updated_at`
      )
      .bind(
        clerkUserId,
        payload.accessToken,
        payload.refreshToken,
        payload.tokenExpiryAt,
        JSON.stringify(payload.scopes),
        payload.authTimestamp,
        payload.lastRefreshAt ?? null,
        payload.lastRefreshError ?? null,
        nowIso()
      )
      .run()
  }

  async getGoogleTokens(clerkUserId: string): Promise<GoogleTokenRecord | null> {
    return normalizeRow<GoogleTokenRecord>(
      await this.db.prepare('SELECT * FROM google_oauth_tokens WHERE clerk_user_id = ?').bind(clerkUserId).first()
    )
  }

  async saveWatchState(
    clerkUserId: string,
    watch: {
      googleEmail: string
      topicName: string
      lastHistoryId: string | null
      watchExpirationAt: string | null
      status: WatchStatus
      lastNotificationAt?: string | null
      lastSyncAt?: string | null
      lastRenewalAt?: string | null
      lastError?: string | null
    }
  ): Promise<void> {
    await this.db
      .prepare(
        `DELETE FROM gmail_watch_state
         WHERE google_email = ?
           AND clerk_user_id != ?`
      )
      .bind(watch.googleEmail, clerkUserId)
      .run()

    await this.db
      .prepare(
        `INSERT INTO gmail_watch_state (
          clerk_user_id,
          google_email,
          topic_name,
          last_history_id,
          watch_expiration_at,
          last_notification_at,
          last_sync_at,
          last_renewal_at,
          last_error,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(clerk_user_id) DO UPDATE SET
          google_email = excluded.google_email,
          topic_name = excluded.topic_name,
          last_history_id = COALESCE(excluded.last_history_id, gmail_watch_state.last_history_id),
          watch_expiration_at = excluded.watch_expiration_at,
          last_notification_at = COALESCE(excluded.last_notification_at, gmail_watch_state.last_notification_at),
          last_sync_at = COALESCE(excluded.last_sync_at, gmail_watch_state.last_sync_at),
          last_renewal_at = COALESCE(excluded.last_renewal_at, gmail_watch_state.last_renewal_at),
          last_error = excluded.last_error,
          status = excluded.status`
      )
      .bind(
        clerkUserId,
        watch.googleEmail,
        watch.topicName,
        watch.lastHistoryId,
        watch.watchExpirationAt,
        watch.lastNotificationAt ?? null,
        watch.lastSyncAt ?? null,
        watch.lastRenewalAt ?? null,
        watch.lastError ?? null,
        watch.status
      )
      .run()
  }

  async getWatchStateByClerkId(clerkUserId: string): Promise<GmailWatchStateRecord | null> {
    return normalizeRow<GmailWatchStateRecord>(
      await this.db.prepare('SELECT * FROM gmail_watch_state WHERE clerk_user_id = ?').bind(clerkUserId).first()
    )
  }

  async markWatchNotification(clerkUserId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE gmail_watch_state
         SET last_notification_at = ?,
             last_error = NULL
         WHERE clerk_user_id = ?`
      )
      .bind(nowIso(), clerkUserId)
      .run()
  }

  async markWatchSync(clerkUserId: string, lastHistoryId: string | null, status: WatchStatus, lastError?: string | null): Promise<void> {
    await this.db
      .prepare(
        `UPDATE gmail_watch_state
         SET last_sync_at = ?,
             last_history_id = COALESCE(?, last_history_id),
             status = ?,
             last_error = ?
         WHERE clerk_user_id = ?`
      )
      .bind(nowIso(), lastHistoryId, status, lastError ?? null, clerkUserId)
      .run()
  }

  async listUsersForWatchRenewal(expiringBefore: string): Promise<Array<ClerkUserRecord & { watch_expiration_at: string | null }>> {
    const result = await this.db
      .prepare(
        `SELECT u.*, gws.watch_expiration_at
         FROM users u
         LEFT JOIN gmail_watch_state gws ON gws.clerk_user_id = u.clerk_user_id
         WHERE u.google_auth_status = 'active'
           AND (gws.watch_expiration_at IS NULL OR gws.watch_expiration_at <= ?)`
      )
      .bind(expiringBefore)
      .all<Record<string, unknown>>()
    return (result.results ?? []) as unknown as Array<ClerkUserRecord & { watch_expiration_at: string | null }>
  }

  async listUsersInErrorState(): Promise<ClerkUserRecord[]> {
    const result = await this.db
      .prepare("SELECT * FROM users WHERE google_auth_status IN ('error', 'reauth_required')")
      .all<Record<string, unknown>>()
    return (result.results ?? []) as unknown as ClerkUserRecord[]
  }

  async hasProcessedMessage(clerkUserId: string, gmailMessageId: string): Promise<boolean> {
    const record = await this.db
      .prepare(
        'SELECT gmail_message_id FROM gmail_processed_messages WHERE clerk_user_id = ? AND gmail_message_id = ?'
      )
      .bind(clerkUserId, gmailMessageId)
      .first()
    return Boolean(record)
  }

  async recordProcessedMessage(clerkUserId: string, gmailMessageId: string, gmailThreadId: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO gmail_processed_messages (
          clerk_user_id,
          gmail_message_id,
          gmail_thread_id,
          processed_at
        ) VALUES (?, ?, ?, ?)`
      )
      .bind(clerkUserId, gmailMessageId, gmailThreadId, nowIso())
      .run()
  }

  async hasProcessedDelivery(pubsubMessageId: string): Promise<boolean> {
    const record = await this.db
      .prepare('SELECT pubsub_message_id FROM pubsub_deliveries WHERE pubsub_message_id = ?')
      .bind(pubsubMessageId)
      .first()
    return Boolean(record)
  }

  async recordDelivery(pubsubMessageId: string, googleEmail: string, historyId: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO pubsub_deliveries (
          pubsub_message_id,
          google_email,
          history_id,
          received_at
        ) VALUES (?, ?, ?, ?)`
      )
      .bind(pubsubMessageId, googleEmail, historyId, nowIso())
      .run()
  }
}

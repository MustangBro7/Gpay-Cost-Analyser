import { Transaction, TransactionHeadRecord } from '../types'
import { nowIso } from '../utils/time'

const MAX_WRITE_RETRIES = 5
const PLACEHOLDER_EMAIL_SUFFIX = '@placeholder.local'

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.endsWith(PLACEHOLDER_EMAIL_SUFFIX))
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function transactionKey(ownerClerkUserId: string, version: number): string {
  return `transactions/${ownerClerkUserId}/v${version}.json`
}

function transactionFingerprint(transaction: Transaction): string {
  return JSON.stringify([
    transaction.Date,
    transaction.Amount,
    transaction.Receiver,
    transaction.Classification,
    transaction.PaidToMe ?? null,
    transaction.OriginalAmount ?? null,
    transaction.Payers ?? null,
  ])
}

export class TransactionRepository {
  constructor(private readonly db: D1Database, private readonly bucket: R2Bucket) {}

  async getTransactions(clerkUserId: string): Promise<Transaction[]> {
    const { head } = await this.resolveHead(clerkUserId)
    if (!head) {
      return []
    }
    return this.loadTransactions(head.current_r2_key)
  }

  async mutateTransactions<T>(
    clerkUserId: string,
    mutate: (transactions: Transaction[]) => Promise<T> | T
  ): Promise<{ result: T; transactions: Transaction[] }> {
    const ownerClerkUserId = await this.resolveOwnerClerkUserId(clerkUserId)

    for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
      const { head } = await this.resolveHead(clerkUserId, ownerClerkUserId)
      const currentTransactions = head ? await this.loadTransactions(head.current_r2_key) : []
      const nextTransactions = structuredClone(currentTransactions)
      const result = await mutate(nextTransactions)
      const nextVersion = (head?.version ?? 0) + 1
      const nextKey = transactionKey(ownerClerkUserId, nextVersion)

      await this.bucket.put(nextKey, JSON.stringify(nextTransactions, null, 2), {
        httpMetadata: {
          contentType: 'application/json',
        },
      })

      const updated = await this.compareAndSwapHead(ownerClerkUserId, head, nextKey, nextVersion)
      if (updated) {
        return { result, transactions: nextTransactions }
      }
    }

    throw new Error('Failed to update transactions after multiple retries.')
  }

  private async resolveOwnerClerkUserId(clerkUserId: string): Promise<string> {
    const row = await this.db
      .prepare(
        `SELECT u.clerk_email, u.google_email, g.google_email AS watch_google_email
         FROM users u
         LEFT JOIN gmail_watch_state g ON g.clerk_user_id = u.clerk_user_id
         WHERE u.clerk_user_id = ?`
      )
      .bind(clerkUserId)
      .first<{ clerk_email: string | null; google_email: string | null; watch_google_email: string | null }>()

    const identityEmail = row?.google_email ?? row?.watch_google_email ?? null
    if (identityEmail) {
      const legacyOwner = await this.findExistingOwnerByEmail(normalizeEmail(identityEmail), clerkUserId)
      if (legacyOwner) {
        return legacyOwner
      }
    }

    if (row?.clerk_email && !isPlaceholderEmail(row.clerk_email)) {
      const legacyOwner = await this.findExistingOwnerByEmail(normalizeEmail(row.clerk_email), clerkUserId)
      if (legacyOwner) {
        return legacyOwner
      }
    }

    return clerkUserId
  }

  private async resolveHead(
    clerkUserId: string,
    ownerClerkUserId?: string
  ): Promise<{ ownerClerkUserId: string; head: TransactionHeadRecord | null }> {
    const resolvedOwnerClerkUserId = ownerClerkUserId ?? (await this.resolveOwnerClerkUserId(clerkUserId))

    const canonicalHead = await this.getHead(resolvedOwnerClerkUserId)
    if (canonicalHead) {
      return { ownerClerkUserId: resolvedOwnerClerkUserId, head: canonicalHead }
    }

    const currentHead = resolvedOwnerClerkUserId !== clerkUserId ? await this.getHead(clerkUserId) : null
    const legacyHeads = await this.findLegacyHeads(clerkUserId, resolvedOwnerClerkUserId)
    const headsToMerge = [...legacyHeads]
    if (currentHead) {
      headsToMerge.unshift(currentHead)
    }

    if (headsToMerge.length === 0) {
      return { ownerClerkUserId: resolvedOwnerClerkUserId, head: null }
    }

    const mergedTransactions = await this.mergeTransactionsFromHeads(headsToMerge)
    const nextVersion = 1
    const nextKey = transactionKey(resolvedOwnerClerkUserId, nextVersion)
    await this.bucket.put(nextKey, JSON.stringify(mergedTransactions, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    const timestamp = nowIso()
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO transaction_heads (
          clerk_user_id,
          current_r2_key,
          version,
          updated_at
        ) VALUES (?, ?, ?, ?)`
      )
      .bind(resolvedOwnerClerkUserId, nextKey, nextVersion, timestamp)
      .run()

    return {
      ownerClerkUserId: resolvedOwnerClerkUserId,
      head: {
        clerk_user_id: resolvedOwnerClerkUserId,
        current_r2_key: nextKey,
        version: nextVersion,
        updated_at: timestamp,
      },
    }
  }

  private async getHead(ownerClerkUserId: string): Promise<TransactionHeadRecord | null> {
    const record = await this.db
      .prepare('SELECT * FROM transaction_heads WHERE clerk_user_id = ?')
      .bind(ownerClerkUserId)
      .first<TransactionHeadRecord>()
    return record ?? null
  }

  private async findExistingOwnerByEmail(email: string, currentClerkUserId: string): Promise<string | null> {
    const row = await this.db
      .prepare(
        `SELECT th.clerk_user_id
         FROM transaction_heads th
         LEFT JOIN users u ON u.clerk_user_id = th.clerk_user_id
         LEFT JOIN gmail_watch_state g ON g.clerk_user_id = th.clerk_user_id
         WHERE th.clerk_user_id != ?
           AND (
             lower(COALESCE(u.google_email, '')) = ?
             OR lower(COALESCE(g.google_email, '')) = ?
             OR lower(COALESCE(u.clerk_email, '')) = ?
           )
         ORDER BY th.updated_at DESC
         LIMIT 1`
      )
      .bind(currentClerkUserId, email, email, email)
      .first<{ clerk_user_id: string }>()

    return row?.clerk_user_id ?? null
  }

  private async findLegacyHeads(clerkUserId: string, ownerClerkUserId: string): Promise<TransactionHeadRecord[]> {
    if (ownerClerkUserId === clerkUserId) {
      return []
    }
    return []
  }

  private async loadTransactions(key: string): Promise<Transaction[]> {
    const object = await this.bucket.get(key)
    if (!object) {
      return []
    }
    const text = await object.text()
    if (!text.trim()) {
      return []
    }
    return JSON.parse(text) as Transaction[]
  }

  private async mergeTransactionsFromHeads(heads: TransactionHeadRecord[]): Promise<Transaction[]> {
    const merged = new Map<string, Transaction>()

    for (const head of heads) {
      const transactions = await this.loadTransactions(head.current_r2_key)
      for (const transaction of transactions) {
        merged.set(transactionFingerprint(transaction), transaction)
      }
    }

    return [...merged.values()].sort((a, b) => a.Date.localeCompare(b.Date))
  }

  private async compareAndSwapHead(
    ownerClerkUserId: string,
    currentHead: TransactionHeadRecord | null,
    nextKey: string,
    nextVersion: number
  ): Promise<boolean> {
    const timestamp = nowIso()

    if (!currentHead) {
      const inserted = await this.db
        .prepare(
          `INSERT OR IGNORE INTO transaction_heads (
            clerk_user_id,
            current_r2_key,
            version,
            updated_at
          ) VALUES (?, ?, ?, ?)`
        )
        .bind(ownerClerkUserId, nextKey, nextVersion, timestamp)
        .run()
      return (inserted.meta?.changes ?? 0) > 0
    }

    const updated = await this.db
      .prepare(
        `UPDATE transaction_heads
         SET current_r2_key = ?, version = ?, updated_at = ?
         WHERE clerk_user_id = ? AND version = ?`
      )
      .bind(nextKey, nextVersion, timestamp, ownerClerkUserId, currentHead.version)
      .run()
    return (updated.meta?.changes ?? 0) > 0
  }
}

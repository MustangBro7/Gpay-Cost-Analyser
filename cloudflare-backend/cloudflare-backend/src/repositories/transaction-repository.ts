import { Transaction, TransactionHeadRecord } from '../types'
import { nowIso } from '../utils/time'

const MAX_WRITE_RETRIES = 5

function transactionKey(clerkUserId: string, version: number): string {
  return `transactions/${clerkUserId}/v${version}.json`
}

export class TransactionRepository {
  constructor(private readonly db: D1Database, private readonly bucket: R2Bucket) {}

  async getTransactions(clerkUserId: string): Promise<Transaction[]> {
    const head = await this.getHead(clerkUserId)
    if (!head) {
      return []
    }
    return this.loadTransactions(head.current_r2_key)
  }

  async mutateTransactions<T>(
    clerkUserId: string,
    mutate: (transactions: Transaction[]) => Promise<T> | T
  ): Promise<{ result: T; transactions: Transaction[] }> {
    for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
      const head = await this.getHead(clerkUserId)
      const currentTransactions = head ? await this.loadTransactions(head.current_r2_key) : []
      const nextTransactions = structuredClone(currentTransactions)
      const result = await mutate(nextTransactions)
      const nextVersion = (head?.version ?? 0) + 1
      const nextKey = transactionKey(clerkUserId, nextVersion)

      await this.bucket.put(nextKey, JSON.stringify(nextTransactions, null, 2), {
        httpMetadata: {
          contentType: 'application/json',
        },
      })

      const updated = await this.compareAndSwapHead(clerkUserId, head, nextKey, nextVersion)
      if (updated) {
        return { result, transactions: nextTransactions }
      }
    }

    throw new Error('Failed to update transactions after multiple retries.')
  }

  private async getHead(clerkUserId: string): Promise<TransactionHeadRecord | null> {
    const record = await this.db
      .prepare('SELECT * FROM transaction_heads WHERE clerk_user_id = ?')
      .bind(clerkUserId)
      .first<TransactionHeadRecord>()
    return record ?? null
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

  private async compareAndSwapHead(
    clerkUserId: string,
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
        .bind(clerkUserId, nextKey, nextVersion, timestamp)
        .run()
      return (inserted.meta?.changes ?? 0) > 0
    }

    const updated = await this.db
      .prepare(
        `UPDATE transaction_heads
         SET current_r2_key = ?, version = ?, updated_at = ?
         WHERE clerk_user_id = ? AND version = ?`
      )
      .bind(nextKey, nextVersion, timestamp, clerkUserId, currentHead.version)
      .run()
    return (updated.meta?.changes ?? 0) > 0
  }
}

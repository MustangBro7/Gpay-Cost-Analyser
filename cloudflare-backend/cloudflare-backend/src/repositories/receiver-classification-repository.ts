import { ReceiverClassificationRecord } from '../types'
import { nowIso } from '../utils/time'
import { normalizeReceiverKey, normalizeReceiverLabel } from '../utils/receiver'

export interface ReceiverClassificationStore {
  findByReceiver(clerkUserId: string, receiver: string): Promise<{ receiver: string; classification: string } | null>
  upsert(clerkUserId: string, receiver: string, classification: string): Promise<void>
}

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

export class ReceiverClassificationRepository implements ReceiverClassificationStore {
  constructor(private readonly db: D1Database) {}

  async findByReceiver(
    clerkUserId: string,
    receiver: string
  ): Promise<{ receiver: string; classification: string } | null> {
    const receiverKey = normalizeReceiverKey(receiver)
    if (!receiverKey) {
      return null
    }

    const result = await this.db
      .prepare('SELECT * FROM receiver_classification_memory WHERE clerk_user_id = ? AND receiver_key = ?')
      .bind(clerkUserId, receiverKey)
      .first()

    const record = normalizeRow<ReceiverClassificationRecord>(result)
    if (!record) {
      return null
    }

    return {
      receiver: record.receiver_label,
      classification: record.classification,
    }
  }

  async upsert(clerkUserId: string, receiver: string, classification: string): Promise<void> {
    const receiverLabel = normalizeReceiverLabel(receiver)
    const receiverKey = normalizeReceiverKey(receiverLabel)
    if (!receiverKey || !receiverLabel || !classification.trim()) {
      return
    }

    const existing = normalizeRow<ReceiverClassificationRecord>(
      await this.db
        .prepare('SELECT * FROM receiver_classification_memory WHERE clerk_user_id = ? AND receiver_key = ?')
        .bind(clerkUserId, receiverKey)
        .first()
    )
    const timestamp = nowIso()

    await this.db
      .prepare(
        `INSERT INTO receiver_classification_memory (
          clerk_user_id,
          receiver_key,
          receiver_label,
          classification,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(clerk_user_id, receiver_key) DO UPDATE SET
          receiver_label = excluded.receiver_label,
          classification = excluded.classification,
          updated_at = excluded.updated_at`
      )
      .bind(
        clerkUserId,
        receiverKey,
        receiverLabel,
        classification.trim(),
        existing?.created_at ?? timestamp,
        timestamp
      )
      .run()
  }
}

import { nowIso } from '../utils/time'
import { normalizeReceiverKey, normalizeReceiverLabel } from '../utils/receiver'

export interface ReceiverAliasStore {
  findDisplayName(clerkUserId: string, receiver: string): Promise<string | null>
  /** Maps each of `receivers` to `displayName`, and repoints aliases that targeted one of them. */
  upsert(clerkUserId: string, receivers: string[], displayName: string): Promise<void>
}

export class ReceiverAliasRepository implements ReceiverAliasStore {
  constructor(private readonly db: D1Database) {}

  async findDisplayName(clerkUserId: string, receiver: string): Promise<string | null> {
    const receiverKey = normalizeReceiverKey(receiver)
    if (!receiverKey) {
      return null
    }

    const record = await this.db
      .prepare('SELECT display_name FROM receiver_aliases WHERE clerk_user_id = ? AND receiver_key = ?')
      .bind(clerkUserId, receiverKey)
      .first<{ display_name: string }>()
    return record?.display_name ?? null
  }

  async upsert(clerkUserId: string, receivers: string[], displayName: string): Promise<void> {
    const display = normalizeReceiverLabel(displayName)
    const displayKey = normalizeReceiverKey(display)
    if (!displayKey) {
      return
    }

    const timestamp = nowIso()
    const labels = new Map<string, string>()
    for (const receiver of receivers) {
      const label = normalizeReceiverLabel(receiver)
      const key = normalizeReceiverKey(label)
      if (key && key !== displayKey) {
        labels.set(key, label)
      }
    }

    const statements = [...labels].map(([key, label]) =>
      this.db
        .prepare(
          `INSERT INTO receiver_aliases (clerk_user_id, receiver_key, receiver_label, display_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(clerk_user_id, receiver_key) DO UPDATE SET
             display_name = excluded.display_name,
             updated_at = excluded.updated_at`
        )
        .bind(clerkUserId, key, label, display, timestamp, timestamp)
    )

    // Renaming "Swiggy" to "Food delivery" should also move raw names that already mapped to "Swiggy".
    for (const label of labels.values()) {
      statements.push(
        this.db
          .prepare('UPDATE receiver_aliases SET display_name = ?, updated_at = ? WHERE clerk_user_id = ? AND display_name = ?')
          .bind(display, timestamp, clerkUserId, label)
      )
    }

    // The new name is canonical; it must never be rewritten by a stale alias of its own.
    statements.push(
      this.db
        .prepare('DELETE FROM receiver_aliases WHERE clerk_user_id = ? AND receiver_key = ?')
        .bind(clerkUserId, displayKey)
    )

    await this.db.batch(statements)
  }
}

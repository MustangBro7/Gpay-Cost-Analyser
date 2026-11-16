import { Transaction } from '../types'
import { HttpError } from '../utils/http'
import { cleanReceiverName, isNoisyReceiver, MAX_RECEIVER_LENGTH, normalizeReceiverKey, normalizeReceiverLabel } from '../utils/receiver'

export function requireReceiverName(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} is required.`)
  }
  const name = normalizeReceiverLabel(value)
  if (!name) {
    throw new HttpError(400, `${field} is required.`)
  }
  if (name.length > MAX_RECEIVER_LENGTH) {
    throw new HttpError(400, `${field} must be at most ${MAX_RECEIVER_LENGTH} characters.`)
  }
  return name
}

export interface RenameReceiverOutcome {
  updated: Transaction[]
  /** Distinct receiver labels that were replaced, for alias bookkeeping. */
  previousNames: string[]
}

/**
 * Renames the receiver on `original` and, when `applyToAll` is set, on every other transaction
 * whose receiver normalizes to the same key.
 */
export function renameReceiver(
  items: Transaction[],
  original: Transaction,
  newReceiver: string,
  applyToAll: boolean
): RenameReceiverOutcome {
  const target =
    items.find((entry) => entry.Date === original.Date && entry.Amount === original.Amount) ??
    items.find((entry) => entry.Date === original.Date)
  if (!target) {
    throw new HttpError(404, 'Transaction not found.')
  }

  const targetKey = normalizeReceiverKey(target.Receiver ?? '')
  const matches = applyToAll && targetKey
    ? items.filter((entry) => normalizeReceiverKey(entry.Receiver ?? '') === targetKey)
    : [target]

  const previousNames = new Set<string>()
  for (const entry of matches) {
    if (entry.Receiver) {
      previousNames.add(entry.Receiver)
    }
    entry.Receiver = newReceiver
  }

  return { updated: matches, previousNames: [...previousNames] }
}

export interface ReceiverRepairPlan {
  transaction: Transaction
  cleanedReceiver: string | null
}

export function findNoisyReceivers(items: Transaction[]): ReceiverRepairPlan[] {
  return items
    .filter((entry) => typeof entry.Receiver === 'string' && isNoisyReceiver(entry.Receiver))
    .map((transaction) => ({ transaction, cleanedReceiver: cleanReceiverName(transaction.Receiver) }))
}

export interface ReceiverRepairPatch {
  Date: string
  Amount: string
  fromReceiver: string
  toReceiver: string
  classification?: string
}

export interface ReceiverRepairResult {
  repaired: number
  removedDuplicates: number
}

/**
 * Applies repair patches in place. A repaired row that shares Date + Amount with another row is
 * the same payment stored twice (once from the model, once from the old regex fallback), so it is
 * dropped and its tags merged onto the surviving row.
 */
export function applyReceiverRepairs(items: Transaction[], patches: ReceiverRepairPatch[]): ReceiverRepairResult {
  let repaired = 0
  let removedDuplicates = 0

  for (const patch of patches) {
    const index = items.findIndex(
      (entry) => entry.Date === patch.Date && entry.Amount === patch.Amount && entry.Receiver === patch.fromReceiver
    )
    if (index === -1) {
      continue
    }

    const entry = items[index]
    const twin = items.find(
      (other, otherIndex) =>
        otherIndex !== index &&
        other.Date === entry.Date &&
        other.Amount === entry.Amount &&
        !isNoisyReceiver(other.Receiver)
    )
    if (twin) {
      if (entry.Tags?.length) {
        twin.Tags = [...new Set([...(twin.Tags ?? []), ...entry.Tags])]
      }
      items.splice(index, 1)
      removedDuplicates += 1
      continue
    }

    entry.Receiver = patch.toReceiver
    if (patch.classification) {
      entry.Classification = patch.classification
    }
    repaired += 1
  }

  return { repaired, removedDuplicates }
}

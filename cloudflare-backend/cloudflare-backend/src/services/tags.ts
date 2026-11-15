import { TagSummary, TagTarget, Transaction } from '../types'
import { HttpError } from '../utils/http'

export const MAX_TAG_LENGTH = 32
export const MAX_TAGS_PER_TRANSACTION = 10
export const MAX_TAG_TARGETS = 500

function tagKey(tag: string): string {
  return tag.toLowerCase()
}

function parseAmount(value: string | undefined): number {
  return Number.parseFloat((value ?? '').replace(/,/g, '')) || 0
}

/** Trims, strips a leading "#", and collapses whitespace. Returns null for an empty tag. */
export function normalizeTagName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.replace(/^#+/, '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return null
  }
  if (normalized.length > MAX_TAG_LENGTH) {
    throw new HttpError(400, `Tags must be ${MAX_TAG_LENGTH} characters or fewer.`)
  }
  return normalized
}

export function requireTagName(value: unknown, field: string): string {
  const tag = normalizeTagName(value)
  if (!tag) {
    throw new HttpError(400, `${field} is required.`)
  }
  return tag
}

/** Validates an optional list of tags and de-duplicates it case-insensitively. */
export function normalizeTagList(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an array of strings.`)
  }

  const seen = new Set<string>()
  const tags: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new HttpError(400, `${field} must be an array of strings.`)
    }
    const tag = normalizeTagName(entry)
    if (tag && !seen.has(tagKey(tag))) {
      seen.add(tagKey(tag))
      tags.push(tag)
    }
  }
  return tags
}

export function normalizeTagTargets(value: unknown): TagTarget[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, 'transactions must be a non-empty array.')
  }
  if (value.length > MAX_TAG_TARGETS) {
    throw new HttpError(400, `You can tag up to ${MAX_TAG_TARGETS} transactions at once.`)
  }

  return value.map((entry, index) => {
    const target = entry as Partial<TagTarget> | null
    if (!target || typeof target !== 'object' || typeof target.Date !== 'string' || typeof target.Amount !== 'string') {
      throw new HttpError(400, `transactions[${index}] must include Date and Amount.`)
    }
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(target.Date)) {
      throw new HttpError(400, `transactions[${index}].Date must be in YYYY-MM-DD HH:MM:SS format.`)
    }
    return {
      Date: target.Date,
      Amount: target.Amount,
      Receiver: typeof target.Receiver === 'string' ? target.Receiver : undefined,
    }
  })
}

/** Writes tags onto a transaction, dropping the field entirely when no tags remain. */
export function setTransactionTags(transaction: Transaction, tags: string[]): void {
  if (tags.length === 0) {
    delete transaction.Tags
    return
  }
  transaction.Tags = tags
}

/** Maps lower-cased tag names to the casing already in use, so "goa trip" joins "Goa Trip". */
function buildCanonicalTags(items: Transaction[]): Map<string, string> {
  const canonical = new Map<string, string>()
  for (const item of items) {
    for (const tag of item.Tags ?? []) {
      if (!canonical.has(tagKey(tag))) {
        canonical.set(tagKey(tag), tag)
      }
    }
  }
  return canonical
}

export function canonicalizeTags(items: Transaction[], tags: string[]): string[] {
  const canonical = buildCanonicalTags(items)
  return tags.map((tag) => canonical.get(tagKey(tag)) ?? tag)
}

function matchesTarget(transaction: Transaction, target: TagTarget): boolean {
  if (transaction.Date !== target.Date) {
    return false
  }
  if (transaction.Amount !== target.Amount && parseAmount(transaction.Amount) !== parseAmount(target.Amount)) {
    return false
  }
  return target.Receiver === undefined || transaction.Receiver === target.Receiver
}

export function applyTagChanges(
  items: Transaction[],
  targets: TagTarget[],
  add: string[],
  remove: string[]
): { updated: Transaction[]; missing: number } {
  const additions = canonicalizeTags(items, add)
  const removals = new Set(remove.map(tagKey))
  const pending = new Map<Transaction, string[]>()
  let missing = 0

  // Compute every change first so a validation failure leaves the dataset untouched.
  for (const target of targets) {
    const match = items.find((item) => !pending.has(item) && matchesTarget(item, target))
    if (!match) {
      missing += 1
      continue
    }

    const next = (match.Tags ?? []).filter((tag) => !removals.has(tagKey(tag)))
    for (const tag of additions) {
      if (!next.some((existing) => tagKey(existing) === tagKey(tag))) {
        next.push(tag)
      }
    }
    if (next.length > MAX_TAGS_PER_TRANSACTION) {
      throw new HttpError(400, `A transaction can have at most ${MAX_TAGS_PER_TRANSACTION} tags.`)
    }
    pending.set(match, next)
  }

  for (const [transaction, tags] of pending) {
    setTransactionTags(transaction, tags)
  }

  return { updated: [...pending.keys()], missing }
}

/** Renames a tag everywhere; renaming onto an existing tag merges the two. */
export function renameTagEverywhere(items: Transaction[], from: string, to: string): number {
  const fromKey = tagKey(from)
  const canonical = buildCanonicalTags(items)
  canonical.delete(fromKey)
  const target = canonical.get(tagKey(to)) ?? to
  let changed = 0

  for (const item of items) {
    if (!item.Tags?.some((tag) => tagKey(tag) === fromKey)) {
      continue
    }
    const next: string[] = []
    for (const tag of item.Tags) {
      const value = tagKey(tag) === fromKey ? target : tag
      if (!next.some((existing) => tagKey(existing) === tagKey(value))) {
        next.push(value)
      }
    }
    setTransactionTags(item, next)
    changed += 1
  }

  return changed
}

export function removeTagEverywhere(items: Transaction[], tag: string): number {
  const key = tagKey(tag)
  let changed = 0
  for (const item of items) {
    if (!item.Tags?.some((existing) => tagKey(existing) === key)) {
      continue
    }
    setTransactionTags(
      item,
      item.Tags.filter((existing) => tagKey(existing) !== key)
    )
    changed += 1
  }
  return changed
}

export function summarizeTags(items: Transaction[]): TagSummary[] {
  const summaries = new Map<string, TagSummary>()
  for (const item of items) {
    for (const tag of item.Tags ?? []) {
      const key = tagKey(tag)
      const summary = summaries.get(key) ?? {
        name: tag,
        count: 0,
        total: 0,
        firstDate: item.Date,
        lastDate: item.Date,
      }
      summary.count += 1
      summary.total += parseAmount(item.Amount)
      if (item.Date < summary.firstDate) summary.firstDate = item.Date
      if (item.Date > summary.lastDate) summary.lastDate = item.Date
      summaries.set(key, summary)
    }
  }

  return [...summaries.values()]
    .map((summary) => ({ ...summary, total: Math.round(summary.total * 100) / 100 }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name))
}

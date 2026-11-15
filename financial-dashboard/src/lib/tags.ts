import { GroupBy, TagSummary } from "@/types/Tag"
import { Transaction } from "@/types/Transaction"

export const MAX_TAG_LENGTH = 32
export const MAX_TAGS_PER_TRANSACTION = 10

/** Group key for transactions without tags. Never collides with a user tag (tags can't start with "#"). */
export const UNTAGGED_KEY = "#untagged"
export const UNTAGGED_LABEL = "Untagged"

export function parseAmount(value: string) {
  return Number.parseFloat(value.replace(/,/g, "")) || 0
}

/** Mirrors the backend: strips a leading "#", collapses whitespace, enforces the length cap. */
export function normalizeTagName(value: string): string {
  return value.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH)
}

export function sameTag(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}

export function hasTags(transaction: Transaction) {
  return Boolean(transaction.Tags && transaction.Tags.length > 0)
}

/** The buckets a transaction belongs to; in tag view one transaction can sit in several. */
export function getGroupKeys(transaction: Transaction, groupBy: GroupBy): string[] {
  if (groupBy === "classification") {
    return [transaction.Classification]
  }
  return hasTags(transaction) ? transaction.Tags! : [UNTAGGED_KEY]
}

export function formatGroupLabel(key: string) {
  return key === UNTAGGED_KEY ? UNTAGGED_LABEL : key
}

export function groupTotals(transactions: Transaction[], groupBy: GroupBy) {
  const totals = new Map<string, { amount: number; count: number }>()
  transactions.forEach((tx) => {
    const amount = parseAmount(tx.Amount)
    getGroupKeys(tx, groupBy).forEach((key) => {
      const entry = totals.get(key) ?? { amount: 0, count: 0 }
      entry.amount += amount
      entry.count += 1
      totals.set(key, entry)
    })
  })
  return totals
}

/** True when at least one transaction is counted in more than one tag bucket. */
export function hasOverlappingTags(transactions: Transaction[]) {
  return transactions.some((tx) => (tx.Tags?.length ?? 0) > 1)
}

/** Tags present in the given transactions, ordered by spend. */
export function collectTags(transactions: Transaction[]): string[] {
  const totals = new Map<string, { name: string; amount: number }>()
  transactions.forEach((tx) => {
    tx.Tags?.forEach((tag) => {
      const key = tag.toLowerCase()
      const entry = totals.get(key) ?? { name: tag, amount: 0 }
      entry.amount += parseAmount(tx.Amount)
      totals.set(key, entry)
    })
  })
  return [...totals.values()]
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .map((entry) => entry.name)
}

/** Stable identity for a transaction; matches how the API locates transactions. */
export function getTransactionKey(transaction: Transaction) {
  return `${transaction.Date}|${transaction.Amount}|${transaction.Receiver}`
}

export function toTagTarget(transaction: Transaction) {
  return {
    Date: transaction.Date,
    Amount: transaction.Amount,
    Receiver: transaction.Receiver,
  }
}

/** Converts a "YYYY-MM-DD HH:MM:SS" transaction date into a local calendar day. */
function toCalendarDay(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function getTagRange(summary: Pick<TagSummary, "firstDate" | "lastDate">) {
  return { from: toCalendarDay(summary.firstDate), to: toCalendarDay(summary.lastDate) }
}

export function isRangeCovering(
  range: { from: Date; to: Date } | null,
  summary: Pick<TagSummary, "firstDate" | "lastDate">
) {
  if (!range) {
    return false
  }
  const span = getTagRange(summary)
  return range.from.getTime() <= span.from.getTime() && range.to.getTime() >= span.to.getTime()
}

export function normalizeTagSummaries(payload: unknown): TagSummary[] {
  const tags = (payload as { tags?: unknown } | null)?.tags
  if (!Array.isArray(tags)) {
    return []
  }
  return tags.filter(
    (entry): entry is TagSummary =>
      Boolean(entry) &&
      typeof entry.name === "string" &&
      typeof entry.count === "number" &&
      typeof entry.firstDate === "string" &&
      typeof entry.lastDate === "string"
  )
}

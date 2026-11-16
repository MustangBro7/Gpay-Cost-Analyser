export const MAX_RECEIVER_LENGTH = 80

export function normalizeReceiverLabel(receiver: string): string {
  return receiver.replace(/\s+/g, ' ').trim()
}

export function normalizeReceiverKey(receiver: string): string {
  return normalizeReceiverLabel(receiver)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Sentence fragments that only appear when a whole email sentence leaked into the receiver.
const EMAIL_PROSE_PATTERN = /\b(inform you|has been debited|is debited|credit card ending|account ending|transaction reference)\b/i

/**
 * True when a receiver still carries alert-email noise: masked UPI IDs ("VPA ****1234@ybl (NAME"),
 * whole sentences from the email body, or runaway length.
 */
export function isNoisyReceiver(receiver: string | null | undefined): boolean {
  if (!receiver) {
    return false
  }
  const value = normalizeReceiverLabel(receiver)
  return (
    value.length > MAX_RECEIVER_LENGTH ||
    /\*{2,}/.test(value) ||
    /^VPA\b/i.test(value) ||
    EMAIL_PROSE_PATTERN.test(value)
  )
}

/**
 * Reduces a raw receiver string to the display name the bank gave the payee.
 * Returns null when nothing usable is left (e.g. a fully masked ID).
 */
export function cleanReceiverName(receiver: string | null | undefined): string | null {
  if (!receiver) {
    return null
  }

  let value = normalizeReceiverLabel(receiver)

  // A sentence from a card alert: "... towards MERCHANT on 11 Nov, 2026 at ..."
  // Older rows were cut off before " on <date>", so the merchant may run to the end of the string.
  const towards = value.match(/\btowards\s+(.+?)\s+on\s+\d/i) ?? value.match(/\bending\s+\d{4}\s+towards\s+(.+)$/i)
  if (towards && EMAIL_PROSE_PATTERN.test(value)) {
    value = towards[1]
  }

  // UPI payee with a name: "VPA ****1234@ybl (NAME)" or "****1234@ybl (NAME" (closing paren lost).
  const vpaWithName = value.match(/^(?:VPA\s+)?\S*@\S+\s*\(([^)]+)\)?\s*$/i)
  if (vpaWithName) {
    value = vpaWithName[1]
  }

  value = value
    .replace(/^VPA\s+/i, '')
    .replace(/^[\s:;,\-.()[\]{}]+/, '')
    .replace(/[\s:;,\-.([{]+$/, '')
    .trim()

  // Balance a dangling "(" left by truncated names, e.g. "Air Fiber (5G" -> "Air Fiber (5G)".
  if ((value.match(/\(/g)?.length ?? 0) > (value.match(/\)/g)?.length ?? 0)) {
    value = `${value})`
  }

  if (!value || /^[*\sX\d]+$/i.test(value) || EMAIL_PROSE_PATTERN.test(value)) {
    return null
  }

  return value.length > MAX_RECEIVER_LENGTH ? value.slice(0, MAX_RECEIVER_LENGTH).trim() : value
}

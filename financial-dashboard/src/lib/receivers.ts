export const MAX_RECEIVER_LENGTH = 80

const EMAIL_PROSE_PATTERN = /\b(inform you|has been debited|is debited|credit card ending|account ending|transaction reference)\b/i

/** Matches the backend's receiver key: case-, spacing- and punctuation-insensitive. */
export function getReceiverKey(receiver: string) {
  return receiver
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** True when the receiver still carries bank-alert noise (masked UPI IDs, email sentences). */
export function isNoisyReceiver(receiver: string) {
  const value = receiver.replace(/\s+/g, " ").trim()
  return (
    value.length > MAX_RECEIVER_LENGTH ||
    /\*{2,}/.test(value) ||
    /^VPA\b/i.test(value) ||
    EMAIL_PROSE_PATTERN.test(value)
  )
}

/** Best-effort short name for a noisy receiver, used to pre-fill the rename field. */
export function suggestReceiverName(receiver: string) {
  let value = receiver.replace(/\s+/g, " ").trim()

  const towards =
    value.match(/\btowards\s+(.+?)\s+on\s+\d/i) ?? value.match(/\bending\s+\d{4}\s+towards\s+(.+)$/i)
  if (towards && EMAIL_PROSE_PATTERN.test(value)) {
    value = towards[1]
  }

  const vpaWithName = value.match(/^(?:VPA\s+)?\S*@\S+\s*\(([^)]+)\)?\s*$/i)
  // Older alerts: "VPA handle@bank NAME" with no parentheses.
  const vpaThenName = value.match(/^VPA\s+\S*@\S+\s+([A-Za-z].*)$/i)
  if (vpaWithName) {
    value = vpaWithName[1]
  } else if (vpaThenName) {
    value = vpaThenName[1]
  }

  value = value.replace(/^VPA\s+/i, "").trim()
  if (!value || /^[*\sX\d]+$/i.test(value)) {
    return ""
  }
  return value.slice(0, MAX_RECEIVER_LENGTH).trim()
}

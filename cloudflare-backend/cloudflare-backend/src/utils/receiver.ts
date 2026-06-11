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

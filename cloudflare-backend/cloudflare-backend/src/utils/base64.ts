function padBase64(value: string): string {
  const remainder = value.length % 4
  if (remainder === 0) {
    return value
  }
  return `${value}${'='.repeat(4 - remainder)}`
}

export function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeBase64Url(value: string): string {
  const normalized = padBase64(value.replace(/-/g, '+').replace(/_/g, '/'))
  return atob(normalized)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function addHours(base: string | Date, hours: number): string {
  const date = new Date(base)
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

export function addMinutes(base: string | Date, minutes: number): string {
  const date = new Date(base)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

export function diffHours(from: string | Date, to: string | Date): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000
}

export function isPast(value: string | null | undefined): boolean {
  if (!value) {
    return true
  }
  return new Date(value).getTime() <= Date.now()
}

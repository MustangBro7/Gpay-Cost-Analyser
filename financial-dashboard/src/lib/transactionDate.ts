const TRANSACTION_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
const TRANSACTION_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const IST_TIME_ZONE = "Asia/Kolkata"

type ParsedTransactionDate = {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
}

function parseTransactionDate(value: string): ParsedTransactionDate | null {
  const match = value.trim().match(TRANSACTION_DATE_PATTERN)

  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hours: Number(match[4] ?? "0"),
    minutes: Number(match[5] ?? "0"),
    seconds: Number(match[6] ?? "0"),
  }
}

function format12HourTime(hours: number, minutes: number) {
  const meridiem = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 || 12
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${meridiem}`
}

function formatMonthDay(year: number, month: number, day: number, includeYear: boolean) {
  const label = `${day} ${MONTH_NAMES[month - 1]}`
  return includeYear ? `${label} ${year}` : label
}

export function formatTransactionDate(value: string) {
  const parsed = parseTransactionDate(value)

  if (parsed) {
    return `${MONTH_NAMES[parsed.month - 1]} ${parsed.day}, ${parsed.year}, ${format12HourTime(parsed.hours, parsed.minutes)} IST`
  }

  const fallback = new Date(value)
  if (Number.isNaN(fallback.getTime())) {
    return value
  }

  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(fallback)} IST`
}

export function getTransactionDateSortValue(value: string) {
  const parsed = parseTransactionDate(value)

  if (parsed) {
    return Date.UTC(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      parsed.hours,
      parsed.minutes,
      parsed.seconds
    )
  }

  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime()
}

export function getTransactionDateKey(value: string) {
  const parsed = parseTransactionDate(value)

  if (parsed) {
    return `${parsed.year.toString().padStart(4, "0")}-${parsed.month.toString().padStart(2, "0")}-${parsed.day.toString().padStart(2, "0")}`
  }

  const fallback = new Date(value)
  if (Number.isNaN(fallback.getTime())) {
    return value
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fallback)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

export function formatTransactionDateKey(value: string, includeYear = false) {
  const match = value.match(TRANSACTION_DAY_PATTERN)

  if (match) {
    return formatMonthDay(Number(match[1]), Number(match[2]), Number(match[3]), includeYear)
  }

  const fallback = new Date(value)
  if (Number.isNaN(fallback.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(fallback)
}

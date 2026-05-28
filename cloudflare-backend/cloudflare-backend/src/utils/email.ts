import { ParsedEmailMessage } from '../types'
import { decodeBase64Url } from './base64'

type GmailMessagePart = {
  mimeType?: string
  filename?: string
  body?: {
    data?: string
  }
  headers?: Array<{ name: string; value: string }>
  parts?: GmailMessagePart[]
}

type GmailMessageResponse = {
  id: string
  threadId: string
  payload?: GmailMessagePart
}

const TRANSACTION_TIME_ZONE = 'Asia/Kolkata'

function getHeader(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  const match = headers?.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
  return match?.value ?? ''
}

function collectBodies(part: GmailMessagePart | undefined, mimeType: string, results: string[]): void {
  if (!part) {
    return
  }

  if (part.mimeType === mimeType && part.body?.data) {
    results.push(decodeBase64Url(part.body.data))
  }

  for (const child of part.parts ?? []) {
    collectBodies(child, mimeType, results)
  }
}

function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractEmailTimestamp(dateHeader: string | null): string | null {
  if (!dateHeader) {
    return null
  }
  const parsed = new Date(dateHeader)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TRANSACTION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(parsed)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`
}

export function parseGmailMessage(message: GmailMessageResponse): ParsedEmailMessage {
  const headers = message.payload?.headers ?? []
  const textBodies: string[] = []
  const htmlBodies: string[] = []

  collectBodies(message.payload, 'text/plain', textBodies)
  collectBodies(message.payload, 'text/html', htmlBodies)

  const plainText = textBodies.join('\n').trim()
  const htmlText = stripHtml(htmlBodies.join('\n'))
  const bodyText = plainText || htmlText
  const dateHeader = getHeader(headers, 'Date') || null

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader(headers, 'From'),
    subject: getHeader(headers, 'Subject'),
    dateHeader,
    sentAt: extractEmailTimestamp(dateHeader),
    bodyText,
  }
}

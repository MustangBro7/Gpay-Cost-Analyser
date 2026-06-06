import { DEFAULT_CLASSIFICATION_RULES_TEXT } from './classification-settings'
import { AiAgentEvalSource, ClassificationSettings, Env, Transaction } from '../types'
import { HttpError } from '../utils/http'
import { AiAgentEvalRepository } from '../repositories/ai-agent-eval-repository'

interface PartialTransaction {
  Amount?: string
  Receiver?: string
  Date?: string
  Classification?: string
}

interface ClassificationRunContext {
  clerkUserId: string
  clerkEmail: string
  source: AiAgentEvalSource
  gmailMessageId?: string | null
  gmailThreadId?: string | null
}

interface ClassificationAttemptResult {
  prompt: string | null
  model: string | null
  aiOutput: string | null
  parsedOutput: PartialTransaction | null
  errorMessage: string | null
  latencyMs: number | null
  status: 'success' | 'error' | 'skipped'
}

const CLASSIFICATION_RULES = [
  { pattern: /\b(blinkit|zepto)\b/i, classification: 'Quick Commerce' },
  { pattern: /\b(amazon|flipkart)\b/i, classification: 'Ecommerce' },
  { pattern: /\b(spotify|netflix|hotstar|google play)\b/i, classification: 'Subscriptions' },
  { pattern: /\b(bmtc bus|bangalore metro rail corporation ltd|metro)\b/i, classification: 'Public Transport' },
  { pattern: /\bhungerbox\b/i, classification: 'Office Lunch' },
  { pattern: /\b(super market|supermarket|store|mart)\b/i, classification: 'Grocery' },
  { pattern: /\b(zomato|restaurant|cafe|pizza|burger|biryani|kitchen|eatery)\b/i, classification: 'Eating Out' },
  { pattern: /\bfuel\b/i, classification: 'Fuel' },
]

function sanitizeBody(body: string): string {
  return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseHdfcDebitEmail(body: string, emailTimestamp?: string | null): PartialTransaction | null {
  const cleanBody = sanitizeBody(body)
  const result: PartialTransaction = {}

  const amountPatterns = [
    /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s*has been debited/i,
    /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*(?:has been|is|was)\s*debited/i,
    /debited.*?(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i,
  ]

  for (const pattern of amountPatterns) {
    const match = cleanBody.match(pattern)
    if (match?.[1]) {
      result.Amount = match[1].replace(/,/g, '')
      break
    }
  }

  const receiverPatterns = [
    /to VPA\s+[\w\-\.@]+\s+([A-Za-z][A-Za-z0-9\s&\-.]+?)\s+on\s+\d/i,
    /to VPA\s+([\w\-\.@]+)/i,
    /(?:to|at)\s+([A-Za-z][A-Za-z0-9\s&\-.]{2,}?)\s+(?:on|via|using)\s+\d/i,
    /(?:transferred to|paid to|payment to)\s+([A-Za-z0-9\s&\-.]+)/i,
  ]

  for (const pattern of receiverPatterns) {
    const match = cleanBody.match(pattern)
    if (match?.[1]) {
      result.Receiver = match[1].replace(/\s+/g, ' ').trim()
      break
    }
  }

  const datePatterns = [
    /on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:at)?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)?/i,
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\s*(?:at)?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)?/i,
  ]

  outer: for (const pattern of datePatterns) {
    const match = cleanBody.match(pattern)
    if (!match?.[1]) {
      continue
    }

    const dateStr = match[1]
    const timeStr = match[2]?.trim()
    const dateFormats = ['%d-%m-%y', '%d/%m/%y', '%d-%m-%Y', '%d/%m/%Y', '%d %b %Y', '%d %B %Y']
    for (const format of dateFormats) {
      const parsed = parseDate(dateStr, format)
      if (!parsed) {
        continue
      }
      if (timeStr) {
        const withTime = applyParsedTime(parsed, timeStr)
        if (withTime) {
          result.Date = withTime
          break outer
        }
      }
      if (emailTimestamp) {
        const [_, timePart] = emailTimestamp.split(' ')
        result.Date = `${parsed} ${timePart ?? '00:00:00'}`
      } else {
        result.Date = `${parsed} 00:00:00`
      }
      break outer
    }
  }

  if (!result.Date) {
    result.Date = emailTimestamp ?? formatDateTime(new Date())
  }

  return result.Amount ? result : null
}

function parseDate(dateStr: string, format: string): string | null {
  const normalized = dateStr.replace(/\//g, '-').replace(/\s+/g, ' ').trim()
  const parts = normalized.split(/[- ]/)
  if (parts.length !== 3) {
    return null
  }

  const [dayStr, monthStrRaw, yearStr] = parts
  const day = Number(dayStr)
  const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr)
  const monthMap: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  }

  let month: number
  if (format.includes('%b') || format.includes('%B')) {
    month = monthMap[monthStrRaw.toLowerCase()]
  } else {
    month = Number(monthStrRaw)
  }

  if (!day || !month || !year) {
    return null
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function applyParsedTime(datePortion: string, timeStr: string): string | null {
  const value = timeStr.toLowerCase()
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) {
    return null
  }

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? '0')
  const meridiem = match[4]
  if (meridiem === 'pm' && hours < 12) {
    hours += 12
  }
  if (meridiem === 'am' && hours === 12) {
    hours = 0
  }
  return `${datePortion} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatDateTime(value: Date): string {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  const hours = `${value.getHours()}`.padStart(2, '0')
  const minutes = `${value.getMinutes()}`.padStart(2, '0')
  const seconds = `${value.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function classifyHeuristically(receiver: string | undefined): string {
  if (!receiver) {
    return 'Personal Contact'
  }

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(receiver)) {
      return rule.classification
    }
  }

  if (/^[A-Za-z]+(?:\s+[A-Za-z]+){0,2}$/.test(receiver.trim())) {
    return 'Personal Transfer'
  }

  return 'Other'
}

function buildClassificationPrompt(
  body: string,
  timestamp: string | null,
  settings: ClassificationSettings
): string {
  if (settings.usesDefault) {
    return `You are a financial assistant. Extract transaction details from this HDFC Bank debit alert email and classify it.

===Email Body
${sanitizeBody(body)}

===Email Sent Timestamp
${timestamp ?? 'Unavailable'}

===Extraction Instructions
1. Extract Amount as a number string without commas or currency symbols.
2. Extract Receiver or Merchant name.
3. Extract Date and Time in YYYY-MM-DD HH:MM:SS format. Use the email timestamp time when the body only includes a date.
4. Classify the transaction.

===Classification Guidelines
${DEFAULT_CLASSIFICATION_RULES_TEXT}

Respond with strict JSON only:
{
  "Amount": "number string",
  "Classification": "category",
  "Receiver": "merchant or receiver",
  "Date": "YYYY-MM-DD HH:MM:SS"
}`
  }

  const categoryList = settings.categories.map((category) => `- ${category}`).join('\n')

  return `You are a financial assistant. Extract transaction details from this HDFC Bank debit alert email and classify it.

===Email Body
${sanitizeBody(body)}

===Email Sent Timestamp
${timestamp ?? 'Unavailable'}

===Extraction Instructions
1. Extract Amount as a number string without commas or currency symbols.
2. Extract Receiver or Merchant name.
3. Extract Date and Time in YYYY-MM-DD HH:MM:SS format. Use the email timestamp time when the body only includes a date.
4. Classify the transaction.

===Available Categories
Use one of these categories whenever it fits the transaction:
${categoryList}

===Classification Guidelines
${settings.rulesText}

Respond with strict JSON only:
{
  "Amount": "number string",
  "Classification": "category",
  "Receiver": "merchant or receiver",
  "Date": "YYYY-MM-DD HH:MM:SS"
}`
}

async function classifyWithGemini(
  env: Env,
  body: string,
  timestamp: string | null,
  settings: ClassificationSettings
): Promise<ClassificationAttemptResult> {
  const prompt = buildClassificationPrompt(body, timestamp, settings)
  const model = env.GOOGLE_GEMINI_MODEL || 'gemini-3.5-flash'

  if (!env.GEMINI_API_KEY) {
    return {
      prompt,
      model,
      aiOutput: null,
      parsedOutput: null,
      errorMessage: 'Gemini API key is not configured.',
      latencyMs: null,
      status: 'skipped',
    }
  }

  try {
    const startedAt = Date.now()
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      }),
    })
    const latencyMs = Date.now() - startedAt

    if (!response.ok) {
      return {
        prompt,
        model,
        aiOutput: await response.text().catch(() => null),
        parsedOutput: null,
        errorMessage: `Gemini classification failed with status ${response.status}.`,
        latencyMs,
        status: 'error',
      }
    }

    const payload = await response.json<{
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
    }>()
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? null
    if (!text) {
      return {
        prompt,
        model,
        aiOutput: null,
        parsedOutput: null,
        errorMessage: 'Gemini returned an empty response.',
        latencyMs,
        status: 'error',
      }
    }

    const clean = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    try {
      return {
        prompt,
        model,
        aiOutput: text,
        parsedOutput: JSON.parse(clean) as PartialTransaction,
        errorMessage: null,
        latencyMs,
        status: 'success',
      }
    } catch {
      return {
        prompt,
        model,
        aiOutput: text,
        parsedOutput: null,
        errorMessage: 'Gemini output could not be parsed as JSON.',
        latencyMs,
        status: 'error',
      }
    }
  } catch (error) {
    return {
      prompt,
      model,
      aiOutput: null,
      parsedOutput: null,
      errorMessage: error instanceof Error ? error.message : 'Unknown Gemini request failure.',
      latencyMs: null,
      status: 'error',
    }
  }
}

async function logClassificationAttempt(
  env: Env,
  context: ClassificationRunContext,
  settings: ClassificationSettings,
  body: string,
  timestamp: string | null,
  attempt: ClassificationAttemptResult,
  transaction: Transaction | null
): Promise<void> {
  try {
    const repository = new AiAgentEvalRepository(env.DB)
    await repository.create({
      clerkUserId: context.clerkUserId,
      clerkEmail: context.clerkEmail,
      source: context.source,
      status: attempt.status,
      model: attempt.model,
      emailTimestamp: timestamp,
      gmailMessageId: context.gmailMessageId ?? null,
      gmailThreadId: context.gmailThreadId ?? null,
      inputBody: body,
      prompt: attempt.prompt,
      aiOutput: attempt.aiOutput,
      parsedOutputJson: attempt.parsedOutput ? JSON.stringify(attempt.parsedOutput) : null,
      finalTransactionJson: transaction ? JSON.stringify(transaction) : null,
      errorMessage: attempt.errorMessage,
      latencyMs: attempt.latencyMs,
      usedCustomRules: !settings.usesDefault,
    })
  } catch (error) {
    console.error('Failed to persist AI agent eval record:', error)
  }
}

export async function extractAndClassifyTransaction(
  env: Env,
  body: string,
  emailTimestamp: string | null,
  settings: ClassificationSettings,
  context: ClassificationRunContext
): Promise<Transaction | null> {
  const parsed = parseHdfcDebitEmail(body, emailTimestamp)
  const attempt = await classifyWithGemini(env, body, emailTimestamp, settings)
  const merged = { ...parsed, ...attempt.parsedOutput }

  if (!merged?.Amount) {
    await logClassificationAttempt(env, context, settings, body, emailTimestamp, attempt, null)
    return null
  }

  const receiver = merged.Receiver?.trim() || 'Personal Contact'
  const transaction = {
    Amount: merged.Amount.replace(/,/g, ''),
    Receiver: receiver,
    Date: merged.Date ?? emailTimestamp ?? formatDateTime(new Date()),
    Classification: merged.Classification?.trim() || classifyHeuristically(receiver),
  }
  await logClassificationAttempt(env, context, settings, body, emailTimestamp, attempt, transaction)
  return transaction
}

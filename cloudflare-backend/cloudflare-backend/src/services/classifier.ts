import { DEFAULT_CLASSIFICATION_RULES_TEXT } from './classification-settings'
import { AiAgentEvalSource, ClassificationSettings, Env, Transaction } from '../types'
import { HttpError } from '../utils/http'
import { AiAgentEvalRepository } from '../repositories/ai-agent-eval-repository'
import { ReceiverAliasStore } from '../repositories/receiver-alias-repository'
import { ReceiverClassificationStore } from '../repositories/receiver-classification-repository'
import { cleanReceiverName, isNoisyReceiver, MAX_RECEIVER_LENGTH, normalizeReceiverLabel } from '../utils/receiver'

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

function cleanReceiverCandidate(candidate: string | undefined): string | null {
  if (!candidate) {
    return null
  }

  const cleaned = candidate
    .replace(/^[\s:;,\-.()[\]{}]+/, '')
    .replace(/[\s:;,\-.()[\]{}]+$/, '')
    .replace(/\b(on|using|via)\b\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Anything this long is a sentence the pattern swallowed, not a payee name.
  if (!cleaned || cleaned.length > MAX_RECEIVER_LENGTH || isNoisyReceiver(cleaned)) {
    return null
  }

  return cleaned
}

// Ordered from most to least specific. HDFC masks UPI IDs ("VPA ****1234@ybl (NAME)"), so the VPA
// token is matched as any non-space run rather than a strict UPI handle.
const RECEIVER_PATTERNS = [
  /\b(?:to|towards)\s+VPA\s+\S+\s*\(([^)]{1,80})\)/i,
  /\b(?:to|towards)\s+VPA\s+\S+@\S+\s+([A-Za-z][A-Za-z0-9\s&\-.]{0,79}?)\s+on\b/i,
  /\btowards\s+(.{1,80}?)\s+on\s+\d/i,
  /\bcard ending\s+\d{4}\s+at\s+(.{1,80}?)\s+on\s+\d/i,
  /\bpayment to\s+(.{1,80}?)(?:\s+on\b|\s+via\b|\s+using\b|[,.]|$)/i,
  /\btransferred to\s+(.{1,80}?)(?:\s+on\b|\s+via\b|\s+using\b|[,.]|$)/i,
  /\bto\s+(.{1,80}?)\s+(?:using|via)\b/i,
  /\b(?:to|towards)\s+VPA\s+([\w.-]+@[\w.-]+)/i,
]

function parseReceiver(cleanBody: string): string | undefined {
  for (const pattern of RECEIVER_PATTERNS) {
    const cleaned = cleanReceiverCandidate(cleanBody.match(pattern)?.[1])
    if (cleaned) {
      return cleaned
    }
  }

  return undefined
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

  const receiver = parseReceiver(cleanBody)
  if (receiver) {
    result.Receiver = receiver
  }

  const datePatterns = [
    /on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:at)?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)?/i,
    /(\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{2,4})\s*(?:at)?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)?/i,
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
  const normalized = dateStr.replace(/\//g, '-').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
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
  if (!receiver || receiver.trim().toLowerCase() === 'personal contact') {
    return 'Personal Transfer'
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

const SYSTEM_PROMPT = 'You extract structured data from Indian bank debit alert emails. Respond with one JSON object and nothing else.'

function buildClassificationPrompt(
  body: string,
  timestamp: string | null,
  settings: ClassificationSettings
): string {
  const rulesText = settings.usesDefault ? DEFAULT_CLASSIFICATION_RULES_TEXT : settings.rulesText
  return `===Email Body
${sanitizeBody(body)}

===Email Sent Timestamp
${timestamp ?? 'Unavailable'}

===Extraction Instructions
1. Amount: the debited amount as a number string, without commas or currency symbols.
2. Receiver: the short name of the merchant or person that was paid, exactly as the email names them.
   - UPI alerts look like "towards VPA xxxx@bank (NAME) on ...": use NAME only.
   - Card alerts look like "towards MERCHANT on <date>": use MERCHANT only.
   - Never include VPA or UPI IDs, masked digits such as ****, card or account numbers, reference numbers, or sentences from the email.
   - If the email names no receiver, use "Personal Contact".
3. Date: the transaction date and time as YYYY-MM-DD HH:MM:SS. Use the email timestamp's time when the body only gives a date.
4. Classification: one category, following the guidelines below.

===Classification Guidelines
${rulesText}

===Output
{"Amount": "number string", "Receiver": "merchant or person", "Date": "YYYY-MM-DD HH:MM:SS", "Classification": "category"}`
}

const DEFAULT_PRIMARY_MODEL = '@cf/zai-org/glm-5.3'
const DEFAULT_FALLBACK_MODEL = '@cf/google/gemma-4-26b-a4b-it'
const PRIMARY_TIMEOUT_MS = 15_000
const FALLBACK_TIMEOUT_MS = 12_000

/** Model-specific knobs: GLM 5.x always reasons (low keeps it quick); smaller models skip thinking. */
function buildModelInput(model: string, prompt: string): Record<string, unknown> {
  const input: Record<string, unknown> = {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_completion_tokens: 2048,
    response_format: { type: 'json_object' },
  }

  if (/glm-5/.test(model)) {
    input.reasoning_effort = 'low'
  } else if (/deepseek|inkling/.test(model)) {
    input.reasoning_effort = 'none'
  } else {
    input.chat_template_kwargs = { enable_thinking: false }
  }

  return input
}

function extractModelText(result: unknown): string | null {
  const payload = result as {
    response?: unknown
    choices?: Array<{ message?: { content?: unknown } }>
  } | null
  const content = payload?.choices?.[0]?.message?.content ?? payload?.response
  if (typeof content === 'string') {
    return content.trim() || null
  }
  return content && typeof content === 'object' ? JSON.stringify(content) : null
}

function parseModelJson(text: string): PartialTransaction | null {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const candidates = [unfenced]
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start !== -1 && end > start) {
    candidates.push(unfenced.slice(start, end + 1))
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        continue
      }
      const record = parsed as Record<string, unknown>
      const asString = (value: unknown) =>
        typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined
      return {
        Amount: asString(record.Amount),
        Receiver: asString(record.Receiver),
        Date: asString(record.Date),
        Classification: asString(record.Classification),
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

async function classifyWithModel(
  env: Env,
  model: string,
  prompt: string,
  timeoutMs: number
): Promise<ClassificationAttemptResult> {
  const startedAt = Date.now()
  try {
    const result = await runWithTimeout(
      env.AI.run(model as keyof AiModels, buildModelInput(model, prompt) as never),
      timeoutMs
    )
    const latencyMs = Date.now() - startedAt
    const text = extractModelText(result)
    if (!text) {
      return { prompt, model, aiOutput: null, parsedOutput: null, errorMessage: `${model} returned an empty response.`, latencyMs, status: 'error' }
    }

    const parsedOutput = parseModelJson(text)
    if (!parsedOutput) {
      return { prompt, model, aiOutput: text, parsedOutput: null, errorMessage: `${model} output could not be parsed as JSON.`, latencyMs, status: 'error' }
    }

    return { prompt, model, aiOutput: text, parsedOutput, errorMessage: null, latencyMs, status: 'success' }
  } catch (error) {
    return {
      prompt,
      model,
      aiOutput: null,
      parsedOutput: null,
      errorMessage: `${model} failed: ${error instanceof Error ? error.message : String(error)}`,
      latencyMs: Date.now() - startedAt,
      status: 'error',
    }
  }
}

/**
 * Tries the primary model, then the fallback (a separate rate-limit pool), so one overloaded or
 * rate-limited model no longer drops the transaction straight to the regex parser.
 */
async function classifyWithWorkersAi(
  env: Env,
  body: string,
  timestamp: string | null,
  settings: ClassificationSettings
): Promise<ClassificationAttemptResult> {
  const prompt = buildClassificationPrompt(body, timestamp, settings)
  const primaryModel = env.AI_MODEL?.trim() || DEFAULT_PRIMARY_MODEL
  const fallbackModel = env.AI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL

  if (!env.AI) {
    return { prompt, model: primaryModel, aiOutput: null, parsedOutput: null, errorMessage: 'Workers AI binding is not configured.', latencyMs: null, status: 'skipped' }
  }

  const primary = await classifyWithModel(env, primaryModel, prompt, PRIMARY_TIMEOUT_MS)
  if (primary.status === 'success' || !fallbackModel || fallbackModel === primaryModel) {
    return primary
  }

  const fallback = await classifyWithModel(env, fallbackModel, prompt, FALLBACK_TIMEOUT_MS)
  const totalLatency = (primary.latencyMs ?? 0) + (fallback.latencyMs ?? 0)
  return {
    ...fallback,
    latencyMs: totalLatency,
    errorMessage: fallback.status === 'success'
      ? null
      : `${primary.errorMessage} Fallback: ${fallback.errorMessage}`,
    // Keep the primary's raw output when the fallback produced nothing, for eval debugging.
    aiOutput: fallback.aiOutput ?? primary.aiOutput,
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

function buildReceiverMemorySkipAttempt(): ClassificationAttemptResult {
  return {
    prompt: null,
    model: null,
    aiOutput: null,
    parsedOutput: null,
    errorMessage: 'Classification reused from receiver memory.',
    latencyMs: null,
    status: 'skipped',
  }
}

function shouldPersistReceiverClassification(
  attempt: ClassificationAttemptResult,
  transaction: Transaction
): boolean {
  return Boolean(
    attempt.status === 'success' &&
      attempt.parsedOutput?.Classification?.trim() &&
      transaction.Receiver.trim().toLowerCase() !== 'personal contact'
  )
}

/** Applies the user's saved rename for this payee, if any. */
async function resolveDisplayReceiver(
  aliases: ReceiverAliasStore,
  clerkUserId: string,
  receiver: string
): Promise<string> {
  return (await aliases.findDisplayName(clerkUserId, receiver)) ?? receiver
}

export async function extractAndClassifyTransaction(
  env: Env,
  body: string,
  emailTimestamp: string | null,
  settings: ClassificationSettings,
  context: ClassificationRunContext,
  receiverClassifications: ReceiverClassificationStore,
  receiverAliases: ReceiverAliasStore
): Promise<Transaction | null> {
  const parsed = parseHdfcDebitEmail(body, emailTimestamp)
  const parsedReceiver = cleanReceiverName(parsed?.Receiver) ?? ''

  if (parsedReceiver) {
    const displayReceiver = await resolveDisplayReceiver(receiverAliases, context.clerkUserId, parsedReceiver)
    const savedClassification =
      (await receiverClassifications.findByReceiver(context.clerkUserId, displayReceiver)) ??
      (displayReceiver !== parsedReceiver
        ? await receiverClassifications.findByReceiver(context.clerkUserId, parsedReceiver)
        : null)
    if (savedClassification) {
      const attempt = buildReceiverMemorySkipAttempt()
      if (!parsed?.Amount) {
        await logClassificationAttempt(env, context, settings, body, emailTimestamp, attempt, null)
        return null
      }

      const transaction = {
        Amount: parsed.Amount.replace(/,/g, ''),
        Receiver: displayReceiver,
        Date: parsed.Date ?? emailTimestamp ?? formatDateTime(new Date()),
        Classification: savedClassification.classification,
      }
      await logClassificationAttempt(env, context, settings, body, emailTimestamp, attempt, transaction)
      return transaction
    }
  }

  const attempt = await classifyWithWorkersAi(env, body, emailTimestamp, settings)
  const modelOutput = attempt.parsedOutput ?? {}
  const modelAmount = modelOutput.Amount?.replace(/[^\d.]/g, '')
  const amount = modelAmount && Number.parseFloat(modelAmount) > 0 ? modelAmount : parsed?.Amount
  if (!amount) {
    await logClassificationAttempt(env, context, settings, body, emailTimestamp, attempt, null)
    return null
  }

  const rawReceiver = cleanReceiverName(modelOutput.Receiver) || parsedReceiver || 'Personal Contact'
  const receiver = await resolveDisplayReceiver(receiverAliases, context.clerkUserId, normalizeReceiverLabel(rawReceiver))
  const modelDate = modelOutput.Date?.trim()
  const transaction = {
    Amount: amount.replace(/,/g, ''),
    Receiver: receiver,
    Date: modelDate && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(modelDate)
      ? modelDate
      : parsed?.Date ?? emailTimestamp ?? formatDateTime(new Date()),
    Classification: modelOutput.Classification?.trim() || classifyHeuristically(receiver),
  }

  if (shouldPersistReceiverClassification(attempt, transaction)) {
    await receiverClassifications.upsert(context.clerkUserId, transaction.Receiver, transaction.Classification)
  }

  await logClassificationAttempt(env, context, settings, body, emailTimestamp, attempt, transaction)
  return transaction
}

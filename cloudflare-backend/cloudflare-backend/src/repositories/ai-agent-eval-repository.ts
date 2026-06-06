import { AiAgentEvalRecord, AiAgentEvalSource, AiAgentEvalStatus } from '../types'
import { nowIso } from '../utils/time'

function normalizeRow<T>(row: unknown): T | null {
  if (!row) {
    return null
  }
  if (typeof row === 'object' && row !== null && 'results' in row) {
    const resultSet = row as { results?: unknown[] }
    return (resultSet.results?.[0] as T | undefined) ?? null
  }
  return row as T
}

export interface CreateAiAgentEvalInput {
  clerkUserId: string
  clerkEmail: string
  source: AiAgentEvalSource
  status: AiAgentEvalStatus
  model?: string | null
  emailTimestamp?: string | null
  gmailMessageId?: string | null
  gmailThreadId?: string | null
  inputBody: string
  prompt?: string | null
  aiOutput?: string | null
  parsedOutputJson?: string | null
  finalTransactionJson?: string | null
  errorMessage?: string | null
  latencyMs?: number | null
  usedCustomRules: boolean
}

export interface ListAiAgentEvalFilters {
  limit: number
  offset: number
  status?: AiAgentEvalStatus | null
  query?: string | null
}

export class AiAgentEvalRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateAiAgentEvalInput): Promise<AiAgentEvalRecord> {
    const record: AiAgentEvalRecord = {
      id: crypto.randomUUID(),
      clerk_user_id: input.clerkUserId,
      clerk_email: input.clerkEmail,
      source: input.source,
      status: input.status,
      model: input.model ?? null,
      email_timestamp: input.emailTimestamp ?? null,
      gmail_message_id: input.gmailMessageId ?? null,
      gmail_thread_id: input.gmailThreadId ?? null,
      input_body: input.inputBody,
      prompt: input.prompt ?? null,
      ai_output: input.aiOutput ?? null,
      parsed_output_json: input.parsedOutputJson ?? null,
      final_transaction_json: input.finalTransactionJson ?? null,
      error_message: input.errorMessage ?? null,
      latency_ms: input.latencyMs ?? null,
      used_custom_rules: input.usedCustomRules ? 1 : 0,
      created_at: nowIso(),
    }

    await this.db
      .prepare(
        `INSERT INTO ai_agent_evals (
          id,
          clerk_user_id,
          clerk_email,
          source,
          status,
          model,
          email_timestamp,
          gmail_message_id,
          gmail_thread_id,
          input_body,
          prompt,
          ai_output,
          parsed_output_json,
          final_transaction_json,
          error_message,
          latency_ms,
          used_custom_rules,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.clerk_user_id,
        record.clerk_email,
        record.source,
        record.status,
        record.model,
        record.email_timestamp,
        record.gmail_message_id,
        record.gmail_thread_id,
        record.input_body,
        record.prompt,
        record.ai_output,
        record.parsed_output_json,
        record.final_transaction_json,
        record.error_message,
        record.latency_ms,
        record.used_custom_rules,
        record.created_at
      )
      .run()

    return record
  }

  async list(
    filters: ListAiAgentEvalFilters
  ): Promise<{ items: AiAgentEvalRecord[]; total: number }> {
    const clauses: string[] = []
    const bindings: unknown[] = []

    if (filters.status) {
      clauses.push('status = ?')
      bindings.push(filters.status)
    }

    if (filters.query?.trim()) {
      const value = `%${filters.query.trim()}%`
      clauses.push(`(
        clerk_email LIKE ?
        OR clerk_user_id LIKE ?
        OR input_body LIKE ?
        OR prompt LIKE ?
        OR ai_output LIKE ?
        OR error_message LIKE ?
      )`)
      bindings.push(value, value, value, value, value, value)
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as total FROM ai_agent_evals ${whereClause}`)
      .bind(...bindings)
      .first<{ total: number | string }>()
    const countRow = normalizeRow<{ total: number | string }>(countResult)
    const total = Number(countRow?.total ?? 0)

    const result = await this.db
      .prepare(
        `SELECT *
         FROM ai_agent_evals
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ?
         OFFSET ?`
      )
      .bind(...bindings, filters.limit, filters.offset)
      .all<Record<string, unknown>>()

    return {
      items: (result.results ?? []) as unknown as AiAgentEvalRecord[],
      total,
    }
  }
}

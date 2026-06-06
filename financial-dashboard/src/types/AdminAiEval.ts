export type AiEvalStatus = "success" | "error" | "skipped"
export type AiEvalSource = "gmail" | "preview"

export interface AdminAiEval {
  id: string
  clerk_user_id: string
  clerk_email: string
  source: AiEvalSource
  status: AiEvalStatus
  model: string | null
  email_timestamp: string | null
  gmail_message_id: string | null
  gmail_thread_id: string | null
  input_body: string
  prompt: string | null
  ai_output: string | null
  parsed_output_json: string | null
  final_transaction_json: string | null
  error_message: string | null
  latency_ms: number | null
  used_custom_rules: number
  created_at: string
}

export interface AdminAiEvalListResponse {
  items: AdminAiEval[]
  pagination: {
    limit: number
    offset: number
    total: number
    has_more: boolean
  }
}

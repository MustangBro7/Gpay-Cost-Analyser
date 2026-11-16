export interface Env {
  DB: D1Database
  TRANSACTIONS_BUCKET: R2Bucket
  LOCAL_DEV_MODE?: string
  DEV_MOCK_USER_ID?: string
  DEV_MOCK_USER_EMAIL?: string
  DEV_MOCK_USER_ROLE?: UserRole
  ADMIN_EMAILS?: string
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_JWT_KEY?: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_OAUTH_REDIRECT_URI: string
  GOOGLE_PUBSUB_AUDIENCE: string
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: string
  GOOGLE_PUBSUB_TOPIC_NAME: string
  GMAIL_WATCH_LABEL_IDS?: string
  FRONTEND_ORIGIN: string
  FRONTEND_ORIGINS?: string
  AI: Ai
  AI_MODEL?: string
  AI_FALLBACK_MODEL?: string
  MAINTENANCE_TOKEN?: string
  HDFC_SENDERS?: string
}

export type UserRole = 'admin' | 'user'
export type AiAgentEvalSource = 'gmail' | 'preview'
export type AiAgentEvalStatus = 'success' | 'error' | 'skipped'

export interface ClerkUserRecord {
  clerk_user_id: string
  clerk_email: string
  role: UserRole
  google_email: string | null
  google_auth_status: AuthStatus
  google_connected_at: string | null
  created_at: string
  updated_at: string
}

export interface ClassificationSettingsRecord {
  clerk_user_id: string
  categories_json: string
  rules_text: string
  created_at: string
  updated_at: string
}

export interface ReceiverClassificationRecord {
  clerk_user_id: string
  receiver_key: string
  receiver_label: string
  classification: string
  created_at: string
  updated_at: string
}

export interface GoogleTokenRecord {
  clerk_user_id: string
  access_token: string
  refresh_token: string | null
  token_expiry_at: string | null
  scopes_json: string
  auth_timestamp: string
  last_refresh_at: string | null
  last_refresh_error: string | null
  updated_at: string
}

export interface OAuthStateRecord {
  state: string
  clerk_user_id: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface GmailWatchStateRecord {
  clerk_user_id: string
  google_email: string
  topic_name: string
  last_history_id: string | null
  watch_expiration_at: string | null
  last_notification_at: string | null
  last_sync_at: string | null
  last_renewal_at: string | null
  last_error: string | null
  status: WatchStatus
}

export interface TransactionHeadRecord {
  clerk_user_id: string
  current_r2_key: string
  version: number
  updated_at: string
}

export interface AuthenticatedUser {
  clerkUserId: string
  email: string
}

export interface AiAgentEvalRecord {
  id: string
  clerk_user_id: string
  clerk_email: string
  source: AiAgentEvalSource
  status: AiAgentEvalStatus
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

export type AuthStatus = 'disconnected' | 'active' | 'reauth_required' | 'error'
export type WatchStatus = 'active' | 'expired' | 'error' | 'pending'

export interface Transaction {
  Classification: string
  Amount: string
  Receiver: string
  Date: string
  PaidToMe?: string
  Payers?: Array<{ name: string; amount: string }>
  OriginalAmount?: string
  /** Optional user-defined tags; omitted entirely when a transaction has none. */
  Tags?: string[]
}

export interface TagTarget {
  Date: string
  Amount: string
  Receiver?: string
}

export interface TagSummary {
  name: string
  count: number
  total: number
  firstDate: string
  lastDate: string
}

export interface ApplyTagsRequest {
  transactions: TagTarget[]
  add?: string[]
  remove?: string[]
}

export interface RenameTagRequest {
  from: string
  to: string
}

export interface DeleteTagRequest {
  tag: string
}

export interface ClassificationSettings {
  categories: string[]
  rulesText: string
  usesDefault: boolean
  updatedAt: string | null
}

export interface DateRangeRequest {
  startDate: string
  endDate: string
}

export interface UpdateClassificationSettingsRequest {
  categories: string[]
  rulesText: string
}

export interface AddTransactionRequest {
  Amount: string
  Classification: string
  Receiver: string
  Date: string
  Tags?: string[]
}

export interface ClassificationPreviewRequest {
  Amount: string
  Receiver: string
  Date: string
}

export interface ReclassifyRequest {
  original: Transaction
  newClassification: string
}

export interface RenameReceiverRequest {
  original: Transaction
  newReceiver: string
  /** Rename every transaction from this receiver and remember the name for future emails. Defaults to true. */
  applyToAll?: boolean
}

export interface DeleteTransactionRequest {
  original: Transaction
}

export interface NormalizeRequest {
  original: Transaction
  paidToMe?: string | null
  payers?: Array<{ name: string; amount: string }> | null
}

export interface GmailPushEnvelope {
  message: {
    data: string
    messageId: string
    publishTime?: string
  }
  subscription?: string
}

export interface GmailPushPayload {
  emailAddress: string
  historyId: string
}

export interface ParsedEmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  dateHeader: string | null
  sentAt: string | null
  bodyText: string
}

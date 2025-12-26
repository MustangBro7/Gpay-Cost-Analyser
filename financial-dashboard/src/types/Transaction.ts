// src/types/Transaction.ts
export interface Transaction {
  Classification: string
  Amount: string
  Receiver: string
  Date: string
  PaidToMe?: string
  Payers?: Array<{ name: string; amount: string }>
  OriginalAmount?: string
}
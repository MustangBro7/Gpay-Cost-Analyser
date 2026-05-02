import { AddTransactionRequest, AuthenticatedUser, NormalizeRequest, ReclassifyRequest, Transaction } from '../types'
import { HttpError } from '../utils/http'

const seedTransactions: Transaction[] = [
  { Amount: '600.00', Receiver: 'MILANO ICE CREAM PRIVATE LIMITED', Date: '2026-04-29 14:52:08', Classification: 'Other' },
  { Amount: '1065.00', Receiver: 'SRINIDHI VEG FOOD CO', Date: '2026-04-29 14:13:36', Classification: 'Other' },
  { Amount: '1108.00', Receiver: 'inform you that Rs. 1108.00 has been debited from your HDFC Bank Credit Card ending 8030 towards SWIGGY', Date: '2026-04-29 05:48:14', Classification: 'Other' },
  { Amount: '40.00', Receiver: 'S MANJULA', Date: '2026-04-29 03:38:12', Classification: 'Personal Transfer' },
  { Amount: '1000.00', Receiver: 'ICCL GROWW AUTOPAY', Date: '2026-04-29 01:26:36', Classification: 'Personal Transfer' },
  { Amount: '306.00', Receiver: 'Blinkit', Date: '2026-04-28 16:42:18', Classification: 'Quick Commerce' },
  { Amount: '295.00', Receiver: 'HMA VENTURES', Date: '2026-04-28 15:00:23', Classification: 'Personal Transfer' },
  { Amount: '2793.42', Receiver: 'inform you that Rs. 2793.42 has been debited from your HDFC Bank Credit Card ending 8030 towards ETERNAL LIMITED', Date: '2026-04-28 05:53:34', Classification: 'Other' },
  { Amount: '246.00', Receiver: 'Blinkit', Date: '2026-04-27 14:48:59', Classification: 'Quick Commerce' },
  { Amount: '25.00', Receiver: 'KA01AR2804', Date: '2026-04-27 11:09:46', Classification: 'Other' },
  { Amount: '20.00', Receiver: 'UBER INDIA SYSTEMS PRIVATE LIMITED', Date: '2026-04-27 10:50:05', Classification: 'Other' },
  { Amount: '99.00', Receiver: 'EATGOOD TECHNOLOGIES PRIVATE LIMITED', Date: '2026-04-27 07:34:00', Classification: 'Other' },
  { Amount: '20.00', Receiver: 'Namma Yatri', Date: '2026-04-27 02:57:47', Classification: 'Personal Transfer' },
  { Amount: '25.00', Receiver: 'BMTC BUS KA57F1288', Date: '2026-04-27 02:46:22', Classification: 'Public Transport' },
  { Amount: '2500.00', Receiver: 'Groww', Date: '2026-04-26 16:53:54', Classification: 'Personal Transfer' },
  { Amount: '55.00', Receiver: 'PRAKASH B R', Date: '2026-04-26 15:51:14', Classification: 'Personal Transfer' },
  { Amount: '420.00', Receiver: 'PRAKASH B R', Date: '2026-04-26 15:24:45', Classification: 'Personal Transfer' },
  { Amount: '240.00', Receiver: 'inform you that Rs. 240.00 has been debited from your HDFC Bank Credit Card ending 8030 towards WWW SWIGGY IN', Date: '2026-04-26 05:09:55', Classification: 'Other' },
  { Amount: '205.00', Receiver: 'inform you that Rs. 205.00 has been debited from your HDFC Bank Credit Card ending 8030 towards WWW SWIGGY IN', Date: '2026-04-26 04:59:40', Classification: 'Other' },
  { Amount: '1490.00', Receiver: 'AMMAS PASTRIES SHANKARMAT', Date: '2026-04-26 04:47:22', Classification: 'Personal Transfer' },
  { Amount: '379.00', Receiver: 'PRAVEEN', Date: '2026-04-26 03:35:47', Classification: 'Personal Transfer' },
  { Amount: '1049.00', Receiver: 'Valve Corporation', Date: '2026-04-25 11:27:39', Classification: 'Personal Transfer' },
  { Amount: '239.00', Receiver: 'Blinkit', Date: '2026-04-25 07:23:48', Classification: 'Quick Commerce' },
  { Amount: '35.00', Receiver: 'BMTC', Date: '2026-04-24 11:18:28', Classification: 'Personal Transfer' },
  { Amount: '20.00', Receiver: 'Namma Yatri', Date: '2026-04-24 10:56:30', Classification: 'Personal Transfer' },
  { Amount: '20.00', Receiver: 'Namma Yatri', Date: '2026-04-24 10:55:44', Classification: 'Personal Transfer' },
  { Amount: '10.00', Receiver: 'HungerBox', Date: '2026-04-24 04:49:26', Classification: 'Office Lunch' },
  { Amount: '20.00', Receiver: 'Namma Yatri', Date: '2026-04-24 02:52:18', Classification: 'Personal Transfer' },
  { Amount: '25.00', Receiver: 'BMTC BUS KA57F0322', Date: '2026-04-24 02:42:19', Classification: 'Public Transport' },
]

let devTransactions = seedTransactions.map(cloneTransaction)

function cloneTransaction(transaction: Transaction): Transaction {
  return {
    ...transaction,
    Payers: transaction.Payers?.map((payer) => ({ ...payer })),
  }
}

function cloneTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map(cloneTransaction)
}

export function getDevTransactions(): Transaction[] {
  return cloneTransactions(devTransactions)
}

export function addDevTransaction(payload: AddTransactionRequest): Transaction {
  const exists = devTransactions.some((entry) => entry.Date === payload.Date && entry.Amount === payload.Amount)
  if (exists) {
    throw new HttpError(400, 'A transaction with this date and amount already exists.')
  }

  const transaction: Transaction = {
    Amount: payload.Amount.replace(/,/g, ''),
    Classification: payload.Classification,
    Receiver: payload.Receiver.trim(),
    Date: payload.Date,
  }

  devTransactions.push(transaction)
  return cloneTransaction(transaction)
}

export function reclassifyDevTransaction(payload: ReclassifyRequest): {
  transactions: Transaction[]
  updatedTransaction: Transaction
} {
  const match = devTransactions.find((entry) => entry.Date === payload.original.Date)
  if (!match) {
    throw new HttpError(404, 'Transaction not found.')
  }

  match.Classification = payload.newClassification

  return {
    transactions: cloneTransactions(devTransactions),
    updatedTransaction: cloneTransaction(match),
  }
}

export function normalizeDevTransaction(payload: NormalizeRequest): {
  transactions: Transaction[]
  updatedTransaction: Transaction
} {
  const transaction = devTransactions.find((entry) => entry.Date === payload.original.Date)
  if (!transaction) {
    throw new HttpError(404, 'Transaction not found.')
  }

  const validPayers = (payload.payers ?? []).filter((payer) => payer.name.trim() && payer.amount.trim())
  const paidToMeTotal = validPayers.reduce((sum, payer) => sum + (parseFloat(payer.amount.replace(/,/g, '')) || 0), 0)

  if (paidToMeTotal > 0) {
    const originalAmount =
      parseFloat(
        (
          transaction.OriginalAmount ??
          payload.original.OriginalAmount ??
          String((parseFloat(transaction.Amount) || 0) + (parseFloat(transaction.PaidToMe ?? '0') || 0))
        ).replace(/,/g, '')
      ) || 0

    transaction.OriginalAmount = String(originalAmount)
    transaction.PaidToMe = String(paidToMeTotal)
    transaction.Payers = validPayers

    const netAmount = originalAmount - paidToMeTotal
    transaction.Amount = Number.isInteger(netAmount)
      ? `${netAmount}`
      : netAmount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  } else {
    transaction.PaidToMe = undefined
    transaction.Payers = undefined

    if (transaction.OriginalAmount) {
      transaction.Amount = transaction.OriginalAmount
    }

    transaction.OriginalAmount = undefined
  }

  return {
    transactions: cloneTransactions(devTransactions),
    updatedTransaction: cloneTransaction(transaction),
  }
}

export function getDevTokenStatus(user: AuthenticatedUser) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  return {
    user_id: user.clerkUserId,
    authenticated: true,
    auth_timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: expiresAt,
    hours_remaining: 720,
    needs_reauth: false,
    message: 'Local dev mock mode is active.',
    google_email: user.email,
    auth_status: 'active' as const,
    watch_expires_at: expiresAt,
    last_sync_at: now.toISOString(),
    reauth_reason: null,
  }
}

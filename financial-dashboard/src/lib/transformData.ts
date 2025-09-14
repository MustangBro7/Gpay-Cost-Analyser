import { Transaction } from "@/types/Transaction"

export function transformData(transactions: Transaction[]): Record<string, number> {
  const groupMap: Record<string, number> = {}

  transactions.forEach((tx) => {
    const key = tx.Classification
    const amount = parseFloat(tx.Amount)

    if (!isNaN(amount)) {
      groupMap[key] = (groupMap[key] || 0) + amount
    }
  })

  return groupMap
}
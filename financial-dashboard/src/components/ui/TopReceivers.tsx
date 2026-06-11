'use client'

import * as React from "react"
import { Store } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Transaction } from "@/types/Transaction"
import { cn } from "@/lib/utils"

const MAX_RECEIVERS = 6

const BAR_COLORS = [
  "bg-[var(--chart-1)]",
  "bg-[var(--chart-2)]",
  "bg-[var(--chart-3)]",
  "bg-[var(--chart-4)]",
  "bg-[var(--chart-5)]",
  "bg-[var(--chart-1)]",
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function TopReceivers({ data }: { data: Transaction[] }) {
  const receivers = React.useMemo(() => {
    const totals = new Map<string, { amount: number; count: number }>()
    data.forEach((tx) => {
      const key = tx.Receiver?.trim() || "Unknown"
      const amount = Number.parseFloat(tx.Amount.replace(/,/g, "")) || 0
      const entry = totals.get(key) ?? { amount: 0, count: 0 }
      entry.amount += amount
      entry.count += 1
      totals.set(key, entry)
    })

    return Array.from(totals.entries())
      .map(([receiver, { amount, count }]) => ({ receiver, amount, count }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_RECEIVERS)
  }, [data])

  const maxAmount = receivers[0]?.amount ?? 0

  return (
    <Card className="h-full rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Store className="size-4" />
          </span>
          Top Receivers
        </CardTitle>
        <CardDescription>Where the most money went in this range.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {receivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receivers in the selected range.</p>
        ) : (
          receivers.map((entry, index) => (
            <div key={entry.receiver} className="space-y-1.5">
              <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{entry.receiver}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatCurrency(entry.amount)}
                  <span className="ml-1.5 text-xs">
                    · {entry.count} txn{entry.count === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className={cn("h-2 rounded-full", BAR_COLORS[index])}
                  style={{ width: `${maxAmount > 0 ? Math.max(4, (entry.amount / maxAmount) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

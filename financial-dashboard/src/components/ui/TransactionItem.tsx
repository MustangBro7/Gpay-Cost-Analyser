"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NormalizeTransactionDialog } from "@/components/ui/NormalizeTransactionDialog"
import { formatTransactionDate } from "@/lib/transactionDate"
import { Transaction } from "@/types/Transaction"
import { useAuthedFetch } from "@/lib/useAuthedFetch"

export function TransactionItem({
  tx,
  refetch,
}: {
  tx: Transaction
  refetch: () => void
}) {
  const [newClass, setNewClass] = React.useState("")
  const [normalizeDialogOpen, setNormalizeDialogOpen] = React.useState(false)
  const website_url = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  const handleReclassify = async () => {
    try {
      await authedFetch(`${website_url}/reclassify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original: tx,
          newClassification: newClass,
        }),
      })

      toast("Reclassification submitted!", {
        description: `Updated "${tx.Classification}" → "${newClass}"`,
      })
      setNewClass("")
      refetch()
    } catch (err) {
      console.error(err)
      toast("Failed to submit reclassification.")
    }
  }

  return (
    <>
      <li className="space-y-2 rounded-2xl border border-border/70 bg-background/75 p-4 text-sm shadow-sm">
        <div>
          <strong>₹{tx.Amount}</strong> to {tx.Receiver}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatTransactionDate(tx.Date)}
        </div>
        <div className="text-xs text-muted-foreground">
          Current: {tx.Classification}
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="New classification"
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            className="h-9 text-xs"
          />
          <Button
            size="sm"
            className="h-9"
            onClick={handleReclassify}
          >
            Reclassify
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => setNormalizeDialogOpen(true)}
          >
            Normalize
          </Button>
        </div>
      </li>
      <NormalizeTransactionDialog
        open={normalizeDialogOpen}
        onOpenChange={setNormalizeDialogOpen}
        transaction={tx}
        onSuccess={refetch}
      />
    </>
  )
}

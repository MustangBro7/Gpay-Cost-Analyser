"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NormalizeTransactionDialog } from "@/components/ui/NormalizeTransactionDialog"
import { Transaction } from "@/types/Transaction"

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

  const handleReclassify = async () => {
    try {
      await fetch(`${website_url}/reclassify`, {
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
      <li className="border rounded-md p-3 bg-card shadow-sm text-sm space-y-1">
        <div>
          <strong>₹{tx.Amount}</strong> to {tx.Receiver}
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(tx.Date).toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">
          Current: {tx.Classification}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder="New classification"
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            className="h-8"
            onClick={handleReclassify}
          >
            Reclassify
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
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
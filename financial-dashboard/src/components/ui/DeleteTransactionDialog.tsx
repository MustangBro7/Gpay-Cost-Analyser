"use client"

import * as React from "react"
import { toast } from "sonner"
import { Transaction } from "@/types/Transaction"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { formatTransactionDate } from "@/lib/transactionDate"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeleteTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction
  onSuccess: () => void
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: DeleteTransactionDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const websiteUrl = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  const handleDelete = async () => {
    setIsSubmitting(true)
    try {
      const response = await authedFetch(`${websiteUrl}/delete-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original: transaction }),
      })

      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`)
      }

      toast.success("Transaction deleted", {
        description: `Removed ₹${transaction.Amount} to ${transaction.Receiver}`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Delete failed:", error)
      toast.error("Failed to delete transaction.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete transaction</DialogTitle>
          <DialogDescription>
            This permanently removes the transaction to {transaction.Receiver}. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <div className="font-medium">₹{transaction.Amount}</div>
          <div className="mt-1 text-muted-foreground">
            {formatTransactionDate(transaction.Date)}
          </div>
          <div className="mt-1 text-muted-foreground">{transaction.Classification}</div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Delete transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

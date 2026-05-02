"use client"

import * as React from "react"
import { toast } from "sonner"
import { Transaction } from "@/types/Transaction"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ReclassifyTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction
  onSuccess: () => void
}

export function ReclassifyTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: ReclassifyTransactionDialogProps) {
  const [newClassification, setNewClassification] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const websiteUrl = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  React.useEffect(() => {
    if (open) {
      setNewClassification(transaction.Classification)
    }
  }, [open, transaction])

  const handleSubmit = async () => {
    const trimmed = newClassification.trim()
    if (!trimmed) {
      toast.error("Please enter a classification")
      return
    }

    if (trimmed === transaction.Classification) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    try {
      await authedFetch(`${websiteUrl}/reclassify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original: transaction,
          newClassification: trimmed,
        }),
      })

      toast.success("Reclassification submitted", {
        description: `Updated "${transaction.Classification}" to "${trimmed}"`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Reclassification failed:", error)
      toast.error("Failed to submit reclassification.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reclassify Transaction</DialogTitle>
          <DialogDescription>
            Update the classification for {transaction.Receiver}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
            <div className="font-medium">₹{transaction.Amount}</div>
            <div className="mt-1 text-muted-foreground">
              {new Date(transaction.Date).toLocaleString()}
            </div>
            <div className="mt-1 text-muted-foreground">
              Current: {transaction.Classification}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New classification</label>
            <Input
              value={newClassification}
              onChange={(event) => setNewClassification(event.target.value)}
              placeholder="Enter a classification"
              className="h-11"
            />
          </div>
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
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Classification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

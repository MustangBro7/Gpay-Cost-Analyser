"use client"

import * as React from "react"
import { toast } from "sonner"
import { Transaction } from "@/types/Transaction"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { formatTransactionDate } from "@/lib/transactionDate"
import { isNoisyReceiver, MAX_RECEIVER_LENGTH, suggestReceiverName } from "@/lib/receivers"
import { cn } from "@/lib/utils"
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

interface RenameReceiverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction
  /** Transactions in the current view that share this receiver (including this one). */
  matchingCount: number
  onSuccess: () => void
}

export function RenameReceiverDialog({
  open,
  onOpenChange,
  transaction,
  matchingCount,
  onSuccess,
}: RenameReceiverDialogProps) {
  const [newReceiver, setNewReceiver] = React.useState("")
  const [applyToAll, setApplyToAll] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const websiteUrl = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()
  const isNoisy = isNoisyReceiver(transaction.Receiver)

  React.useEffect(() => {
    if (open) {
      setNewReceiver(isNoisy ? suggestReceiverName(transaction.Receiver) : transaction.Receiver)
      setApplyToAll(true)
    }
  }, [open, transaction, isNoisy])

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const trimmed = newReceiver.replace(/\s+/g, " ").trim()
    if (!trimmed) {
      toast.error("Please enter a receiver name")
      return
    }

    if (trimmed === transaction.Receiver) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await authedFetch(`${websiteUrl}/rename-receiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original: transaction,
          newReceiver: trimmed,
          applyToAll,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? `Rename failed with status ${response.status}`)
      }

      const result = (await response.json()) as { updated?: number }
      const updated = result.updated ?? 1
      toast.success("Receiver renamed", {
        description:
          updated > 1
            ? `${updated} transactions now show "${trimmed}".`
            : `This transaction now shows "${trimmed}".`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Rename receiver failed:", error)
      toast.error(error instanceof Error ? error.message : "Failed to rename receiver.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const otherCount = Math.max(matchingCount - 1, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename receiver</DialogTitle>
            <DialogDescription>
              Give this payee a name you&apos;ll recognise in charts and searches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Current name
              </div>
              <div className="mt-1.5 line-clamp-4 font-medium break-words">{transaction.Receiver}</div>
              <div className="mt-2 text-muted-foreground">
                ₹{transaction.Amount} · {formatTransactionDate(transaction.Date)}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="rename-receiver-input" className="text-sm font-medium">
                New name
              </label>
              <Input
                id="rename-receiver-input"
                value={newReceiver}
                onChange={(event) => setNewReceiver(event.target.value)}
                maxLength={MAX_RECEIVER_LENGTH}
                placeholder="e.g. Swiggy"
                autoFocus
                className="h-10 rounded-full px-4"
              />
              {isNoisy ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Suggested from the bank alert. Edit it to whatever you like.
                </p>
              ) : null}
            </div>

            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                applyToAll ? "border-primary/50 bg-primary/10" : "border-border/70 bg-card/90"
              )}
            >
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(event) => setApplyToAll(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm leading-6">
                <span className="font-medium">Rename every transaction from this receiver</span>
                <span className="block text-muted-foreground">
                  {otherCount > 0
                    ? `Includes ${otherCount} other transaction${otherCount === 1 ? "" : "s"} in this view, plus older ones. `
                    : "Includes any older transactions. "}
                  New payments from them will use this name too.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TagChip } from "@/components/ui/TagChip"
import { TagInput } from "@/components/ui/TagInput"
import { formatTransactionDate } from "@/lib/transactionDate"
import { MAX_TAGS_PER_TRANSACTION, parseAmount, sameTag, toTagTarget } from "@/lib/tags"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { Transaction } from "@/types/Transaction"

interface TagTransactionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactions: Transaction[]
  /** All known tag names, most relevant first. */
  knownTags: string[]
  onSuccess: () => void
}

type TagState = { tag: string; count: number; initialCount: number }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function buildInitialState(transactions: Transaction[]): TagState[] {
  const states: TagState[] = []
  transactions.forEach((tx) => {
    tx.Tags?.forEach((tag) => {
      const existing = states.find((state) => sameTag(state.tag, tag))
      if (existing) {
        existing.count += 1
        existing.initialCount += 1
      } else {
        states.push({ tag, count: 1, initialCount: 1 })
      }
    })
  })
  return states
}

export function TagTransactionsDialog({
  open,
  onOpenChange,
  transactions,
  knownTags,
  onSuccess,
}: TagTransactionsDialogProps) {
  const [tagStates, setTagStates] = React.useState<TagState[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const websiteUrl = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()
  const total = transactions.length
  const isBulk = total > 1

  React.useEffect(() => {
    if (open) {
      setTagStates(buildInitialState(transactions))
    }
  }, [open, transactions])

  const totalAmount = React.useMemo(
    () => transactions.reduce((sum, tx) => sum + parseAmount(tx.Amount), 0),
    [transactions]
  )

  const changes = React.useMemo(() => {
    const add = tagStates.filter((state) => state.count === total && state.initialCount < total).map((s) => s.tag)
    const remove = tagStates.filter((state) => state.count === 0 && state.initialCount > 0).map((s) => s.tag)
    return { add, remove }
  }, [tagStates, total])

  const hasChanges = changes.add.length > 0 || changes.remove.length > 0
  const activeStates = tagStates.filter((state) => state.count > 0)
  const atLimit =
    !isBulk && activeStates.length >= MAX_TAGS_PER_TRANSACTION

  const addTag = React.useCallback(
    (tag: string) => {
      setTagStates((current) => {
        const existing = current.find((state) => sameTag(state.tag, tag))
        if (existing) {
          return current.map((state) => (state === existing ? { ...state, count: total } : state))
        }
        return [...current, { tag, count: total, initialCount: 0 }]
      })
    },
    [total]
  )

  const restoreTag = React.useCallback((tag: string) => {
    setTagStates((current) =>
      current.map((state) => (sameTag(state.tag, tag) ? { ...state, count: state.initialCount } : state))
    )
  }, [])

  const removeTag = React.useCallback((tag: string) => {
    setTagStates((current) =>
      current
        .map((state) => (sameTag(state.tag, tag) ? { ...state, count: 0 } : state))
        .filter((state) => state.count > 0 || state.initialCount > 0)
    )
  }, [])

  const handleSave = async () => {
    if (!hasChanges) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await authedFetch(`${websiteUrl}/tags/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: transactions.map(toTagTarget),
          add: changes.add,
          remove: changes.remove,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Tagging failed with status ${response.status}`)
      }

      const payload = (await response.json()) as { updated?: number; missing?: number }
      const parts = [
        changes.add.length > 0 ? `Added ${changes.add.join(", ")}` : null,
        changes.remove.length > 0 ? `Removed ${changes.remove.join(", ")}` : null,
      ].filter(Boolean)
      toast.success(
        isBulk ? `Updated tags on ${payload.updated ?? total} transactions` : "Tags updated",
        {
          description:
            parts.join(" · ") +
            (payload.missing ? ` · ${payload.missing} could not be found and were skipped` : ""),
        }
      )
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Tagging failed:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update tags.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const single = transactions[0]

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isBulk ? `Tag ${total} transactions` : "Tag transaction"}</DialogTitle>
          <DialogDescription>
            Tags group related spending, like a trip or an event, without changing its
            classification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
            {isBulk ? (
              <>
                <div className="font-medium">{formatCurrency(totalAmount)} total</div>
                <div className="mt-1 text-muted-foreground">
                  {total} selected transactions
                </div>
              </>
            ) : single ? (
              <>
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{single.Receiver}</span>
                  <span className="shrink-0 font-medium">{formatCurrency(parseAmount(single.Amount))}</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {formatTransactionDate(single.Date)} · {single.Classification}
                </div>
              </>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Tags</div>
            {tagStates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tagStates.map((state) => {
                  const isPartial = state.count > 0 && state.count < total
                  if (state.count === 0) {
                    return (
                      <button
                        key={state.tag}
                        type="button"
                        onClick={() => restoreTag(state.tag)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground line-through decoration-muted-foreground/60 transition hover:text-foreground"
                        title="Removed. Click to restore."
                      >
                        {state.tag}
                      </button>
                    )
                  }
                  return (
                    <TagChip
                      key={state.tag}
                      tag={state.tag}
                      className={isPartial ? "border-dashed bg-transparent" : undefined}
                      meta={isPartial ? `${state.count}/${total}` : undefined}
                      onClick={isPartial ? () => addTag(state.tag) : undefined}
                      onRemove={() => removeTag(state.tag)}
                    />
                  )
                })}
              </div>
            )}
            {tagStates.some((state) => state.count > 0 && state.count < total) ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Dashed tags are on some of the selected transactions. Click one to apply it to all.
              </p>
            ) : null}
          </div>

          <TagInput
            suggestions={knownTags}
            exclude={activeStates.filter((state) => state.count === total).map((state) => state.tag)}
            onAdd={addTag}
            disabled={isSubmitting || atLimit}
            autoFocus
            placeholder={atLimit ? `Up to ${MAX_TAGS_PER_TRANSACTION} tags per transaction` : undefined}
          />
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
          <Button
            type="button"
            className="rounded-full"
            onClick={handleSave}
            disabled={isSubmitting || !hasChanges}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : "Save tags"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

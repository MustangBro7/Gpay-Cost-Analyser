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
import { Input } from "@/components/ui/input"
import { MAX_TAG_LENGTH, normalizeTagName, sameTag } from "@/lib/tags"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { TagSummary } from "@/types/Tag"

export type ManageTagAction = { mode: "rename" | "delete"; tag: string }

interface ManageTagDialogProps {
  action: ManageTagAction | null
  onOpenChange: (open: boolean) => void
  allTags: TagSummary[]
  /** `renamed` is set after a rename so the page can keep a focused tag focused. */
  onSuccess: (renamed?: { from: string; to: string }) => void
}

export function ManageTagDialog({ action, onOpenChange, allTags, onSuccess }: ManageTagDialogProps) {
  const [name, setName] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const websiteUrl = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  React.useEffect(() => {
    if (action) {
      setName(action.tag)
    }
  }, [action])

  const summary = action ? allTags.find((tag) => sameTag(tag.name, action.tag)) : undefined
  const usageCount = summary?.count ?? 0
  const nextName = normalizeTagName(name)
  const mergeTarget =
    action?.mode === "rename"
      ? allTags.find((tag) => sameTag(tag.name, nextName) && !sameTag(tag.name, action.tag))
      : undefined
  const isUnchanged = action?.mode === "rename" && nextName === action.tag

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!action) {
      return
    }
    if (action.mode === "rename" && (!nextName || isUnchanged)) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await authedFetch(
        `${websiteUrl}/tags/${action.mode === "rename" ? "rename" : "delete"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action.mode === "rename" ? { from: action.tag, to: nextName } : { tag: action.tag }
          ),
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Request failed with status ${response.status}`)
      }

      toast.success(
        action.mode === "rename"
          ? mergeTarget
            ? `Merged "${action.tag}" into "${mergeTarget.name}"`
            : `Renamed "${action.tag}" to "${nextName}"`
          : `Removed tag "${action.tag}"`,
        {
          description:
            action.mode === "delete" ? "The transactions themselves were kept." : undefined,
        }
      )
      onOpenChange(false)
      onSuccess(action.mode === "rename" ? { from: action.tag, to: nextName } : undefined)
    } catch (error) {
      console.error("Tag update failed:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update tag.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const usageLabel = `${usageCount} transaction${usageCount === 1 ? "" : "s"}`

  return (
    <Dialog open={Boolean(action)} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        {action?.mode === "rename" ? (
          <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
              <DialogTitle>Rename tag</DialogTitle>
              <DialogDescription>
                Updates &ldquo;{action.tag}&rdquo; on all {usageLabel}, across every date range.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-1">
              <label htmlFor="rename-tag-input" className="text-sm font-medium">
                New name
              </label>
              <Input
                id="rename-tag-input"
                value={name}
                autoFocus
                maxLength={MAX_TAG_LENGTH}
                onChange={(event) => setName(event.target.value)}
                className="h-11 rounded-xl"
              />
              {mergeTarget ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  &ldquo;{mergeTarget.name}&rdquo; already exists. Saving merges both tags into it.
                </p>
              ) : null}
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
                type="submit"
                className="rounded-full"
                disabled={isSubmitting || !nextName || isUnchanged}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {mergeTarget ? "Merge tags" : "Rename tag"}
              </Button>
            </DialogFooter>
          </form>
        ) : action ? (
          <>
            <DialogHeader>
              <DialogTitle>Remove tag</DialogTitle>
              <DialogDescription>
                Removes &ldquo;{action.tag}&rdquo; from {usageLabel}, across every date range. The
                transactions stay in your records.
              </DialogDescription>
            </DialogHeader>
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
                variant="destructive"
                className="rounded-full"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Remove tag
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

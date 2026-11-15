import * as React from "react"
import { Tag, X } from "lucide-react"
import { cn } from "@/lib/utils"

export const tagChipClassName =
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"

interface TagChipProps {
  tag: string
  onRemove?: () => void
  onClick?: () => void
  className?: string
  /** Extra detail after the name, e.g. "2 of 5". */
  meta?: React.ReactNode
}

export function TagChip({ tag, onRemove, onClick, className, meta }: TagChipProps) {
  const content = (
    <>
      <Tag className="size-3 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{tag}</span>
      {meta ? <span className="shrink-0 text-primary/70">{meta}</span> : null}
    </>
  )

  return (
    <span className={cn(tagChipClassName, className)}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex min-w-0 items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {content}
        </button>
      ) : (
        content
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag}`}
          className="-mr-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-primary/70 transition hover:bg-primary/15 hover:text-primary"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

/** Compact, read-only tag list for table rows; collapses overflow into "+N". */
export function TagChipList({
  tags,
  max = 3,
  onTagClick,
  className,
}: {
  tags?: string[]
  max?: number
  onTagClick?: (tag: string) => void
  className?: string
}) {
  if (!tags || tags.length === 0) {
    return null
  }

  const visible = tags.slice(0, max)
  const hidden = tags.length - visible.length

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {visible.map((tag) => (
        <TagChip
          key={tag}
          tag={tag}
          className="max-w-[10rem]"
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        />
      ))}
      {hidden > 0 ? (
        <span
          className="rounded-full border border-border/70 px-1.5 py-0.5 text-xs text-muted-foreground"
          title={tags.slice(max).join(", ")}
        >
          +{hidden}
        </span>
      ) : null}
    </div>
  )
}

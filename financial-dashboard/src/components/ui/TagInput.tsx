"use client"

import * as React from "react"
import { Plus, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MAX_TAG_LENGTH, normalizeTagName, sameTag } from "@/lib/tags"
import { cn } from "@/lib/utils"

interface TagInputProps {
  /** Known tags, most relevant first. */
  suggestions: string[]
  /** Tags already applied; hidden from suggestions. */
  exclude: string[]
  onAdd: (tag: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  /** Number of one-click suggestion chips shown under the input. */
  quickPickCount?: number
}

export function TagInput({
  suggestions,
  exclude,
  onAdd,
  disabled = false,
  placeholder = "Type a tag and press Enter",
  autoFocus = false,
  quickPickCount = 6,
}: TagInputProps) {
  const [query, setQuery] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [highlighted, setHighlighted] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  const available = React.useMemo(
    () => suggestions.filter((tag) => !exclude.some((existing) => sameTag(existing, tag))),
    [exclude, suggestions]
  )

  const normalizedQuery = normalizeTagName(query)

  const options = React.useMemo(() => {
    const matches = normalizedQuery
      ? available.filter((tag) => tag.toLowerCase().includes(normalizedQuery.toLowerCase()))
      : available
    const items = matches.slice(0, 8).map((tag) => ({ tag, isNew: false }))
    const exactMatch =
      suggestions.some((tag) => sameTag(tag, normalizedQuery)) ||
      exclude.some((tag) => sameTag(tag, normalizedQuery))
    if (normalizedQuery && !exactMatch) {
      items.unshift({ tag: normalizedQuery, isNew: true })
    }
    return items
  }, [available, exclude, normalizedQuery, suggestions])

  React.useEffect(() => {
    setHighlighted(0)
  }, [normalizedQuery])

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const commit = React.useCallback(
    (raw: string) => {
      const tag = normalizeTagName(raw)
      if (!tag) {
        return
      }
      // Reuse the existing spelling so "goa trip" lands on "Goa trip".
      const existing = suggestions.find((candidate) => sameTag(candidate, tag))
      if (!exclude.some((candidate) => sameTag(candidate, tag))) {
        onAdd(existing ?? tag)
      }
      setQuery("")
    },
    [exclude, onAdd, suggestions]
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setHighlighted((index) => (index + 1) % options.length)
      return
    }
    if (event.key === "ArrowUp" && options.length > 0) {
      event.preventDefault()
      setHighlighted((index) => (index - 1 + options.length) % options.length)
      return
    }
    if (event.key === "Enter" || event.key === ",") {
      if (!normalizedQuery && event.key === "Enter") {
        return
      }
      event.preventDefault()
      const option = isOpen ? options[highlighted] : undefined
      commit(option ? option.tag : query)
      return
    }
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation()
      setIsOpen(false)
    }
  }

  const quickPicks = available.slice(0, quickPickCount)
  const showList = isOpen && options.length > 0

  return (
    <div ref={containerRef} className="space-y-2.5">
      <div className="relative">
        <Tag className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={MAX_TAG_LENGTH + 1}
          placeholder={placeholder}
          aria-label="Add a tag"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          role="combobox"
          onChange={(event) => {
            setQuery(event.target.value.replace(/,/g, ""))
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-11 rounded-xl pl-10 text-base sm:text-sm"
        />

        {showList ? (
          <div
            id={listId}
            role="listbox"
            className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg"
          >
            {options.map((option, index) => (
              <button
                key={`${option.isNew ? "new" : "tag"}-${option.tag}`}
                type="button"
                role="option"
                aria-selected={index === highlighted}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option.tag)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm outline-none",
                  index === highlighted && "bg-accent text-accent-foreground"
                )}
              >
                {option.isNew ? (
                  <Plus className="size-4 text-muted-foreground" />
                ) : (
                  <Tag className="size-4 text-primary" />
                )}
                <span className="min-w-0 truncate">
                  {option.isNew ? <>Create &ldquo;{option.tag}&rdquo;</> : option.tag}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {quickPicks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Recent:</span>
          {quickPicks.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => commit(tag)}
              className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-50"
            >
              <Plus className="size-3 shrink-0" />
              <span className="truncate">{tag}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

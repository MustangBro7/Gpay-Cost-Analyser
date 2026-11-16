"use client"

import * as React from "react"
import { CalendarRange, MoreHorizontal, PencilLine, Tag, Tags, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  UNTAGGED_KEY,
  formatGroupLabel,
  getGroupKeys,
  isRangeCovering,
  parseAmount,
  sameTag,
} from "@/lib/tags"
import { buildGroupColors, NEUTRAL_CHART_COLOR, type GroupColorFn } from "@/lib/chartColors"
import { formatTransactionDateKey, getTransactionDateKey } from "@/lib/transactionDate"
import { cn } from "@/lib/utils"
import { TagSummary } from "@/types/Tag"
import { Transaction } from "@/types/Transaction"

/** Classifications drawn in a tag's mix bar before the rest fold into "N more". */
const MIX_SLOTS = 5

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatSpan(first: string, last: string) {
  const from = getTransactionDateKey(first)
  const to = getTransactionDateKey(last)
  return from === to
    ? formatTransactionDateKey(from, true)
    : `${formatTransactionDateKey(from)} – ${formatTransactionDateKey(to, true)}`
}

type TagGroup = {
  key: string
  amount: number
  count: number
  firstDate: string
  lastDate: string
  classificationCount: number
  mix: Array<{ classification: string; amount: number; color: string }>
}

function buildGroups(
  data: Transaction[],
  visibleKeys: Set<string>,
  classificationColorFor?: GroupColorFn
): TagGroup[] {
  const getColor =
    classificationColorFor ??
    buildGroupColors(Array.from(new Set(data.map((tx) => tx.Classification))).sort())

  const groups = new Map<string, { amount: number; count: number; firstDate: string; lastDate: string; mix: Map<string, number> }>()

  data.forEach((tx) => {
    const amount = parseAmount(tx.Amount)
    getGroupKeys(tx, "tag").forEach((key) => {
      if (!visibleKeys.has(key)) {
        return
      }
      const group = groups.get(key) ?? {
        amount: 0,
        count: 0,
        firstDate: tx.Date,
        lastDate: tx.Date,
        mix: new Map<string, number>(),
      }
      group.amount += amount
      group.count += 1
      if (tx.Date < group.firstDate) group.firstDate = tx.Date
      if (tx.Date > group.lastDate) group.lastDate = tx.Date
      group.mix.set(tx.Classification, (group.mix.get(tx.Classification) ?? 0) + amount)
      groups.set(key, group)
    })
  })

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const ranked = Array.from(group.mix.entries()).sort((a, b) => b[1] - a[1])
      const top = ranked.slice(0, MIX_SLOTS - 1)
      const rest = ranked.slice(MIX_SLOTS - 1)
      const mix = top.map(([classification, amount]) => ({
        classification,
        amount,
        color: getColor(classification),
      }))
      if (rest.length > 0) {
        mix.push({
          classification: rest.length === 1 ? rest[0][0] : `${rest.length} more`,
          amount: rest.reduce((sum, [, amount]) => sum + amount, 0),
          color: rest.length === 1 ? getColor(rest[0][0]) : NEUTRAL_CHART_COLOR,
        })
      }
      return {
        key,
        amount: group.amount,
        count: group.count,
        firstDate: group.firstDate,
        lastDate: group.lastDate,
        classificationCount: ranked.length,
        mix,
      }
    })
    .sort((a, b) => {
      // Untagged always sits last; everything else by spend.
      if (a.key === UNTAGGED_KEY) return 1
      if (b.key === UNTAGGED_KEY) return -1
      return b.amount - a.amount
    })
}

interface TagBreakdownProps {
  /** Every transaction in the date range (not just the focused ones). */
  data: Transaction[]
  /** Tag keys to list. */
  visibleKeys: Set<string>
  /** Tag keys currently included by the tag filter; the rest are dimmed. */
  selectedKeys: Set<string>
  activeTag: string | null
  onTagSelect: (tag: string) => void
  allTags: TagSummary[]
  dateRange: { from: Date; to: Date } | null
  onShowFullSpan: (summary: TagSummary) => void
  onRename: (tag: string) => void
  onDelete: (tag: string) => void
  /** Stable classification colors shared with the other widgets. */
  classificationColorFor?: GroupColorFn
}

export function TagBreakdown({
  data,
  visibleKeys,
  selectedKeys,
  activeTag,
  onTagSelect,
  allTags,
  dateRange,
  onShowFullSpan,
  onRename,
  onDelete,
  classificationColorFor,
}: TagBreakdownProps) {
  const groups = React.useMemo(
    () => buildGroups(data, visibleKeys, classificationColorFor),
    [classificationColorFor, data, visibleKeys]
  )
  const [menuFor, setMenuFor] = React.useState<string | null>(null)
  const tagCount = groups.filter((group) => group.key !== UNTAGGED_KEY).length

  return (
    <Card className="rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Tags className="size-4" />
          </span>
          Spending by tag
        </CardTitle>
        <CardDescription>
          {tagCount} tag{tagCount === 1 ? "" : "s"} in this range. Select one to focus the
          dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const isUntagged = group.key === UNTAGGED_KEY
            const isActive = activeTag === group.key
            const isDimmed = selectedKeys.size > 0 && !selectedKeys.has(group.key)
            const summary = isUntagged ? undefined : allTags.find((tag) => sameTag(tag.name, group.key))
            const hasMoreOutside =
              summary && summary.count > group.count && !isRangeCovering(dateRange, summary)
            const label = formatGroupLabel(group.key)

            return (
              <div
                key={group.key}
                className={cn(
                  "relative flex min-w-0 flex-col gap-3 rounded-[1.25rem] border border-border/60 bg-muted/20 p-4 transition",
                  isActive && "border-primary/40 bg-primary/5 ring-1 ring-primary/30",
                  isDimmed && "opacity-60 hover:opacity-100"
                )}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onTagSelect(group.key)}
                    aria-pressed={isActive}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left outline-none after:absolute after:inset-0 after:rounded-[1.25rem] focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
                  >
                    <span
                      className={cn(
                        "flex min-w-0 max-w-full items-center gap-1.5 text-sm font-medium",
                        isUntagged ? "text-muted-foreground" : "text-primary"
                      )}
                    >
                      <Tag className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="text-2xl font-semibold tracking-tight text-foreground">
                      {formatCurrency(group.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {group.count} transaction{group.count === 1 ? "" : "s"} ·{" "}
                      {formatSpan(group.firstDate, group.lastDate)}
                    </span>
                  </button>

                  {!isUntagged ? (
                    <Popover
                      open={menuFor === group.key}
                      onOpenChange={(open) => setMenuFor(open ? group.key : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Manage tag ${label}`}
                          className="relative z-10 -mt-1 -mr-1 shrink-0 rounded-full text-muted-foreground"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-44 rounded-2xl border-border/70 p-1.5">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setMenuFor(null)
                            onRename(group.key)
                          }}
                        >
                          <PencilLine className="size-4 text-muted-foreground" />
                          Rename
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setMenuFor(null)
                            onDelete(group.key)
                          }}
                        >
                          <Trash2 className="size-4" />
                          Remove tag
                        </button>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    {group.mix.map((entry) => (
                      <div
                        key={entry.classification}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{
                          width: `${group.amount > 0 ? (entry.amount / group.amount) * 100 : 0}%`,
                          backgroundColor: entry.color,
                        }}
                      />
                    ))}
                  </div>
                  <ul className="space-y-1 text-xs">
                    {group.mix.slice(0, 3).map((entry) => (
                      <li key={entry.classification} className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="min-w-0 truncate text-muted-foreground">
                          {entry.classification}
                        </span>
                        <span className="ml-auto shrink-0 font-medium">
                          {formatCurrency(entry.amount)}
                        </span>
                      </li>
                    ))}
                    {group.classificationCount > 3 ? (
                      <li className="text-muted-foreground">
                        +{group.classificationCount - 3} more classification
                        {group.classificationCount - 3 === 1 ? "" : "s"}
                      </li>
                    ) : null}
                  </ul>
                </div>

                {hasMoreOutside && summary ? (
                  <button
                    type="button"
                    onClick={() => onShowFullSpan(summary)}
                    className="relative z-10 mt-auto inline-flex w-fit items-center gap-1.5 rounded-full text-xs font-medium text-primary hover:underline"
                  >
                    <CalendarRange className="size-3.5" />
                    All {summary.count} transactions · {formatCurrency(summary.total)} (
                    {formatSpan(summary.firstDate, summary.lastDate)})
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

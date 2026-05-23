"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NormalizeTransactionDialog } from "@/components/ui/NormalizeTransactionDialog"
import { ReclassifyTransactionDialog } from "@/components/ui/ReclassifyTransactionDialog"
import { cn } from "@/lib/utils"
import { Transaction } from "@/types/Transaction"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowRight,
  PencilLine,
  RefreshCcw,
  SlidersHorizontal,
  Split,
} from "lucide-react"

interface TransactionTableProps {
  data: Transaction[]
  refetch: () => void
  rangeLabel: string
  activeClassification?: string | null
  hasActiveClassificationFilter?: boolean
  onResetFilters?: () => void
}

const PAGE_SIZE = 10
const stringCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
})

type SortKey = "Date" | "Receiver" | "Classification" | "Amount"
type SortDirection = "asc" | "desc"

const SORT_COLUMNS: Array<{ key: SortKey; label: string; align?: "left" | "right" }> = [
  { key: "Date", label: "Date" },
  { key: "Receiver", label: "Receiver" },
  { key: "Classification", label: "Classification" },
  { key: "Amount", label: "Amount", align: "right" },
]

const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  Date: "desc",
  Receiver: "asc",
  Classification: "asc",
  Amount: "desc",
}

const FALLBACK_BADGE_STYLES = [
  "border-fuchsia-500/20 bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300",
  "border-teal-500/20 bg-teal-500/12 text-teal-700 dark:text-teal-300",
  "border-indigo-500/20 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
  "border-rose-500/20 bg-rose-500/12 text-rose-700 dark:text-rose-300",
]

function formatAmount(value: string) {
  const numeric = Number.parseFloat(value.replace(/,/g, "")) || 0
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numeric)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function parseAmount(value: string) {
  return Number.parseFloat(value.replace(/,/g, "")) || 0
}

function compareTransactions(a: Transaction, b: Transaction, key: SortKey) {
  switch (key) {
    case "Date":
      return new Date(a.Date).getTime() - new Date(b.Date).getTime()
    case "Amount":
      return parseAmount(a.Amount) - parseAmount(b.Amount)
    case "Receiver":
      return stringCollator.compare(a.Receiver, b.Receiver)
    case "Classification":
      return stringCollator.compare(a.Classification, b.Classification)
    default:
      return 0
  }
}

function getClassificationBadgeClassName(classification: string) {
  const normalized = classification.trim().toLowerCase()

  if (!normalized || normalized === "other") {
    return "border-slate-500/20 bg-slate-500/12 text-slate-700 dark:text-slate-300"
  }

  if (normalized.includes("transfer") || normalized.includes("investment")) {
    return "border-sky-500/20 bg-sky-500/12 text-sky-700 dark:text-sky-300"
  }

  if (
    normalized.includes("food") ||
    normalized.includes("lunch") ||
    normalized.includes("dining") ||
    normalized.includes("restaurant")
  ) {
    return "border-orange-500/20 bg-orange-500/12 text-orange-700 dark:text-orange-300"
  }

  if (
    normalized.includes("quick") ||
    normalized.includes("grocery") ||
    normalized.includes("mart")
  ) {
    return "border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  }

  if (
    normalized.includes("transport") ||
    normalized.includes("travel") ||
    normalized.includes("commute")
  ) {
    return "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-300"
  }

  if (
    normalized.includes("office") ||
    normalized.includes("work") ||
    normalized.includes("business")
  ) {
    return "border-violet-500/20 bg-violet-500/12 text-violet-700 dark:text-violet-300"
  }

  if (
    normalized.includes("shopping") ||
    normalized.includes("fashion") ||
    normalized.includes("retail")
  ) {
    return "border-pink-500/20 bg-pink-500/12 text-pink-700 dark:text-pink-300"
  }

  const hash = normalized.split("").reduce((total, char) => total + char.charCodeAt(0), 0)
  return FALLBACK_BADGE_STYLES[hash % FALLBACK_BADGE_STYLES.length]
}

export function TransactionTable({
  data,
  refetch,
  rangeLabel,
  activeClassification,
  hasActiveClassificationFilter = false,
  onResetFilters,
}: TransactionTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [sortKey, setSortKey] = React.useState<SortKey>("Date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [reclassifyTarget, setReclassifyTarget] = React.useState<Transaction | null>(null)
  const [normalizeTarget, setNormalizeTarget] = React.useState<Transaction | null>(null)

  const sortedRows = React.useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const primaryComparison = compareTransactions(a, b, sortKey)

      if (primaryComparison !== 0) {
        return sortDirection === "asc" ? primaryComparison : -primaryComparison
      }

      return new Date(b.Date).getTime() - new Date(a.Date).getTime()
    })
    const counts = new Map<string, number>()

    return sorted.map((tx) => {
      const baseKey = `${tx.Date}-${tx.Receiver}-${tx.Amount}-${tx.Classification}`
      const occurrence = (counts.get(baseKey) ?? 0) + 1
      counts.set(baseKey, occurrence)

      return {
        tx,
        renderKey: `${baseKey}-${occurrence}`,
      }
    })
  }, [data, sortDirection, sortKey])

  const updateSort = React.useCallback((column: SortKey) => {
    if (sortKey === column) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc"
      )
      return
    }

    setSortKey(column)
    setSortDirection(DEFAULT_SORT_DIRECTION[column])
  }, [sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))

  React.useEffect(() => {
    setCurrentPage(1)
  }, [data, sortDirection, sortKey])

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedRows.slice(start, start + PAGE_SIZE)
  }, [currentPage, sortedRows])

  const renderSortIcon = React.useCallback(
    (column: SortKey) => {
      if (sortKey !== column) {
        return <ArrowUpDown className="size-3.5 text-muted-foreground/80" />
      }

      return sortDirection === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : (
        <ArrowDown className="size-3.5" />
      )
    },
    [sortDirection, sortKey]
  )

  return (
    <>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Showing {data.length} transaction{data.length === 1 ? "" : "s"} for {rangeLabel}
              {activeClassification ? ` in ${activeClassification}` : ""}
            </CardDescription>
          </div>

          {hasActiveClassificationFilter && onResetFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full"
              onClick={onResetFilters}
            >
              <RefreshCcw className="size-4" />
              Show all
            </Button>
          ) : null}
        </CardHeader>

        <CardContent>
          {data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-10 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SlidersHorizontal className="size-4" />
              </div>
              <p className="mt-4 text-sm font-medium">No transactions match the current classification filter.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Reset the filter to see all transactions in this date range.
              </p>
              {onResetFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-full"
                  onClick={onResetFilters}
                >
                  <ArrowRight className="size-4" />
                  Show all classifications
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:hidden">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Sort Transactions
                </div>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {SORT_COLUMNS.map((column) => {
                    const isActive = sortKey === column.key

                    return (
                      <Button
                        key={column.key}
                        type="button"
                        size="sm"
                        variant={isActive ? "secondary" : "outline"}
                        className={cn(
                          "h-9 shrink-0 rounded-full px-3",
                          isActive && "shadow-sm"
                        )}
                        onClick={() => updateSort(column.key)}
                      >
                        {column.label}
                        {renderSortIcon(column.key)}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/70 sm:overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="hidden bg-muted/40 text-left text-muted-foreground sm:table-header-group">
                    <tr>
                      {SORT_COLUMNS.map((column) => {
                        const isActive = sortKey === column.key
                        const ariaSort = isActive
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"

                        return (
                          <th
                            key={column.key}
                            aria-sort={ariaSort}
                            className={cn(
                              "px-4 py-3 font-medium",
                              column.align === "right" && "text-right"
                            )}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-auto rounded-full px-2 py-1 text-muted-foreground hover:text-foreground",
                                column.align === "right" ? "ml-auto" : "-ml-2",
                                isActive && "bg-background/80 text-foreground"
                              )}
                              onClick={() => updateSort(column.key)}
                            >
                              {column.label}
                              {renderSortIcon(column.key)}
                            </Button>
                          </th>
                        )
                      })}
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map(({ tx, renderKey }) => (
                      <tr key={renderKey} className="block border-t border-border/70 align-top sm:table-row">
                        <td className="p-0 sm:hidden" colSpan={5}>
                          <div className="space-y-3 px-4 py-3">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] text-muted-foreground">
                                  {formatDate(tx.Date)}
                                </div>
                                <div className="truncate pr-2 text-sm font-medium">
                                  {tx.Receiver}
                                </div>
                              </div>
                              <div className="shrink-0 text-sm font-medium">
                                {formatAmount(tx.Amount)}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-2.5 py-0.5",
                                  getClassificationBadgeClassName(tx.Classification)
                                )}
                              >
                                {tx.Classification}
                              </Badge>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-full"
                                  onClick={() => setReclassifyTarget(tx)}
                                >
                                  <PencilLine className="size-3.5" />
                                  Reclassify
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-full"
                                  onClick={() => setNormalizeTarget(tx)}
                                >
                                  <Split className="size-3.5" />
                                  Normalize
                                </Button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">
                          {formatDate(tx.Date)}
                        </td>
                        <td className="hidden px-4 py-3 font-medium sm:table-cell">{tx.Receiver}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-0.5",
                              getClassificationBadgeClassName(tx.Classification)
                            )}
                          >
                            {tx.Classification}
                          </Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-right font-medium whitespace-nowrap sm:table-cell">
                          {formatAmount(tx.Amount)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full"
                              onClick={() => setReclassifyTarget(tx)}
                            >
                              <PencilLine className="size-3.5" />
                              Reclassify
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full"
                              onClick={() => setNormalizeTarget(tx)}
                            >
                              <Split className="size-3.5" />
                              Normalize
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {reclassifyTarget ? (
        <ReclassifyTransactionDialog
          open={Boolean(reclassifyTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setReclassifyTarget(null)
            }
          }}
          transaction={reclassifyTarget}
          onSuccess={refetch}
        />
      ) : null}

      {normalizeTarget ? (
        <NormalizeTransactionDialog
          open={Boolean(normalizeTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setNormalizeTarget(null)
            }
          }}
          transaction={normalizeTarget}
          onSuccess={refetch}
        />
      ) : null}
    </>
  )
}

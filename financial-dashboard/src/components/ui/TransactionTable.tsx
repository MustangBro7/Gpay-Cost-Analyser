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
import { Input } from "@/components/ui/input"
import { DeleteTransactionDialog } from "@/components/ui/DeleteTransactionDialog"
import { NormalizeTransactionDialog } from "@/components/ui/NormalizeTransactionDialog"
import { ReclassifyTransactionDialog } from "@/components/ui/ReclassifyTransactionDialog"
import { RenameReceiverDialog } from "@/components/ui/RenameReceiverDialog"
import { TagChipList } from "@/components/ui/TagChip"
import { TagTransactionsDialog } from "@/components/ui/TagTransactionsDialog"
import { getReceiverKey } from "@/lib/receivers"
import { getTransactionKey } from "@/lib/tags"
import { formatTransactionDate, getTransactionDateSortValue } from "@/lib/transactionDate"
import { cn } from "@/lib/utils"
import { GroupBy } from "@/types/Tag"
import { Transaction } from "@/types/Transaction"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowRight,
  Check,
  Minus,
  PencilLine,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Split,
  Tag,
  TextCursorInput,
  Trash2,
  X,
} from "lucide-react"

interface TransactionTableProps {
  data: Transaction[]
  refetch: () => void
  rangeLabel: string
  classificationCategories: string[]
  activeClassification?: string | null
  hasActiveClassificationFilter?: boolean
  onResetFilters?: () => void
  /** Known tag names (most relevant first) for tag suggestions. */
  knownTags?: string[]
  /** Called when a tag chip on a row is clicked. */
  onTagClick?: (tag: string) => void
  groupBy?: GroupBy
}

function SelectBox({
  checked,
  indeterminate = false,
  onToggle,
  label,
}: {
  checked: boolean
  indeterminate?: boolean
  onToggle: () => void
  label: string
}) {
  const isOn = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onToggle}
      className="group/select -m-2 inline-flex shrink-0 items-center justify-center p-2 outline-none"
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-[5px] border transition group-focus-visible/select:ring-2 group-focus-visible/select:ring-ring/50",
          isOn
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background group-hover/select:border-primary/60"
        )}
      >
        {checked ? <Check className="size-3" /> : indeterminate ? <Minus className="size-3" /> : null}
      </span>
    </button>
  )
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

function parseAmount(value: string) {
  return Number.parseFloat(value.replace(/,/g, "")) || 0
}

function compareTransactions(a: Transaction, b: Transaction, key: SortKey) {
  switch (key) {
    case "Date":
      return getTransactionDateSortValue(a.Date) - getTransactionDateSortValue(b.Date)
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
  classificationCategories,
  activeClassification,
  hasActiveClassificationFilter = false,
  onResetFilters,
  knownTags = [],
  onTagClick,
  groupBy = "classification",
}: TransactionTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [sortKey, setSortKey] = React.useState<SortKey>("Date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [receiverQuery, setReceiverQuery] = React.useState("")
  const [reclassifyTarget, setReclassifyTarget] = React.useState<Transaction | null>(null)
  const [normalizeTarget, setNormalizeTarget] = React.useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Transaction | null>(null)
  const [renameTarget, setRenameTarget] = React.useState<Transaction | null>(null)
  const [tagTargets, setTagTargets] = React.useState<Transaction[] | null>(null)
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())
  const deferredReceiverQuery = React.useDeferredValue(receiverQuery)
  const normalizedReceiverQuery = deferredReceiverQuery.trim().toLowerCase()

  const filteredData = React.useMemo(() => {
    if (!normalizedReceiverQuery) {
      return data
    }

    return data.filter(
      (tx) =>
        tx.Receiver.toLowerCase().includes(normalizedReceiverQuery) ||
        Boolean(tx.Tags?.some((tag) => tag.toLowerCase().includes(normalizedReceiverQuery)))
    )
  }, [data, normalizedReceiverQuery])

  const receiverCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const tx of data) {
      const key = getReceiverKey(tx.Receiver ?? "")
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [data])

  const sortedRows = React.useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      const primaryComparison = compareTransactions(a, b, sortKey)

      if (primaryComparison !== 0) {
        return sortDirection === "asc" ? primaryComparison : -primaryComparison
      }

      return getTransactionDateSortValue(b.Date) - getTransactionDateSortValue(a.Date)
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
  }, [filteredData, sortDirection, sortKey])

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
  const hasReceiverQuery = receiverQuery.trim().length > 0

  React.useEffect(() => {
    setCurrentPage(1)
  }, [data, normalizedReceiverQuery, sortDirection, sortKey])

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedRows.slice(start, start + PAGE_SIZE)
  }, [currentPage, sortedRows])

  // Selections refer to the rows currently loaded; a refetch starts fresh.
  React.useEffect(() => {
    setSelectedKeys(new Set())
  }, [data])

  const selectedRows = React.useMemo(
    () => filteredData.filter((tx) => selectedKeys.has(getTransactionKey(tx))),
    [filteredData, selectedKeys]
  )
  const selectedTotal = React.useMemo(
    () => selectedRows.reduce((sum, tx) => sum + parseAmount(tx.Amount), 0),
    [selectedRows]
  )
  const pageKeys = React.useMemo(
    () => paginatedRows.map(({ tx }) => getTransactionKey(tx)),
    [paginatedRows]
  )
  const selectedOnPage = pageKeys.filter((key) => selectedKeys.has(key)).length
  const isPageSelected = pageKeys.length > 0 && selectedOnPage === pageKeys.length

  const toggleRow = React.useCallback((tx: Transaction) => {
    const key = getTransactionKey(tx)
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const togglePage = React.useCallback(() => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (pageKeys.every((key) => next.has(key))) {
        pageKeys.forEach((key) => next.delete(key))
      } else {
        pageKeys.forEach((key) => next.add(key))
      }
      return next
    })
  }, [pageKeys])

  const selectAllMatching = React.useCallback(() => {
    setSelectedKeys(new Set(filteredData.map(getTransactionKey)))
  }, [filteredData])

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
              Showing {filteredData.length} of {data.length} transaction
              {filteredData.length === 1 ? "" : "s"} for {rangeLabel}
              {activeClassification ? ` in ${activeClassification}` : ""}
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-80 sm:items-end">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={receiverQuery}
                onChange={(event) => setReceiverQuery(event.target.value)}
                placeholder="Search receiver or tag"
                aria-label="Search transactions by receiver or tag"
                className="h-9 rounded-full pr-10 pl-9"
              />
              {hasReceiverQuery ? (
                <button
                  type="button"
                  onClick={() => setReceiverQuery("")}
                  aria-label="Clear receiver search"
                  className="absolute top-1/2 right-3 inline-flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Times shown in IST</span>
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
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredData.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-10 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SlidersHorizontal className="size-4" />
              </div>
              <p className="mt-4 text-sm font-medium">
                {hasReceiverQuery
                  ? "No transactions match this search."
                  : groupBy === "tag"
                    ? "No transactions match the current tag filter."
                    : "No transactions match the current classification filter."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasReceiverQuery
                  ? "Try a different receiver or tag, or clear the search."
                  : "Reset the filter to see all transactions in this date range."}
              </p>
              {hasReceiverQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-full"
                  onClick={() => setReceiverQuery("")}
                >
                  <ArrowRight className="size-4" />
                  Clear search
                </Button>
              ) : onResetFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-full"
                  onClick={onResetFilters}
                >
                  <ArrowRight className="size-4" />
                  {groupBy === "tag" ? "Show all tags" : "Show all classifications"}
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {selectedRows.length > 0 ? (
                <div
                  role="region"
                  aria-label="Selected transactions"
                  className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">
                      {selectedRows.length} selected
                    </span>
                    <span className="text-muted-foreground"> · {formatAmount(String(selectedTotal))}</span>
                    {selectedRows.length < filteredData.length ? (
                      <button
                        type="button"
                        onClick={selectAllMatching}
                        className="ml-2 text-primary hover:underline"
                      >
                        Select all {filteredData.length}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 rounded-full px-4"
                      onClick={() => setTagTargets(selectedRows)}
                    >
                      <Tag className="size-4" />
                      Tag selected
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 rounded-full"
                      onClick={() => setSelectedKeys(new Set())}
                    >
                      <X className="size-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mb-4 flex flex-col gap-2 sm:hidden">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Sort Transactions
                </div>
                <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                  <div className="flex h-9 shrink-0 items-center rounded-full border border-border/70 px-3">
                    <SelectBox
                      checked={isPageSelected}
                      indeterminate={!isPageSelected && selectedOnPage > 0}
                      onToggle={togglePage}
                      label="Select all transactions on this page"
                    />
                  </div>
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
                      <th className="w-10 py-3 pr-0 pl-4">
                        <SelectBox
                          checked={isPageSelected}
                          indeterminate={!isPageSelected && selectedOnPage > 0}
                          onToggle={togglePage}
                          label="Select all transactions on this page"
                        />
                      </th>
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
                    {paginatedRows.map(({ tx, renderKey }) => {
                      const isSelected = selectedKeys.has(getTransactionKey(tx))
                      return (
                      <tr
                        key={renderKey}
                        className={cn(
                          "block border-t border-border/70 align-top sm:table-row",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <td className="p-0 sm:hidden" colSpan={6}>
                          <div className="space-y-3 px-4 py-3">
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                              <div className="pt-1">
                                <SelectBox
                                  checked={isSelected}
                                  onToggle={() => toggleRow(tx)}
                                  label={`Select transaction to ${tx.Receiver}`}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] text-muted-foreground">
                                  {formatTransactionDate(tx.Date)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setRenameTarget(tx)}
                                  aria-label={`Rename receiver ${tx.Receiver}`}
                                  className="group/rename flex w-full min-w-0 items-center gap-1.5 pr-2 text-left text-sm font-medium"
                                >
                                  <span className="min-w-0 truncate">{tx.Receiver}</span>
                                  <TextCursorInput className="size-3.5 shrink-0 text-muted-foreground group-hover/rename:text-primary" />
                                </button>
                              </div>
                              <div className="shrink-0 text-sm font-medium">
                                {formatAmount(tx.Amount)}
                              </div>
                            </div>

                            <TagChipList tags={tx.Tags} onTagClick={onTagClick} />

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
                                  onClick={() => setTagTargets([tx])}
                                >
                                  <Tag className="size-3.5" />
                                  Tag
                                </Button>
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
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="outline"
                                  aria-label={`Delete transaction to ${tx.Receiver}`}
                                  className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteTarget(tx)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden py-3 pr-0 pl-4 sm:table-cell">
                          <SelectBox
                            checked={isSelected}
                            onToggle={() => toggleRow(tx)}
                            label={`Select transaction to ${tx.Receiver}`}
                          />
                        </td>
                        <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">
                          {formatTransactionDate(tx.Date)}
                        </td>
                        <td className="hidden max-w-sm px-4 py-3 font-medium sm:table-cell">
                          <div className="group/rename flex min-w-0 items-start gap-1.5">
                            <span className="line-clamp-2 min-w-0 break-words" title={tx.Receiver}>
                              {tx.Receiver}
                            </span>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Rename receiver ${tx.Receiver}`}
                              title="Rename receiver"
                              className="-my-1 shrink-0 rounded-full text-muted-foreground opacity-60 transition group-hover/rename:opacity-100 hover:text-primary focus-visible:opacity-100"
                              onClick={() => setRenameTarget(tx)}
                            >
                              <TextCursorInput className="size-3.5" />
                            </Button>
                          </div>
                          <TagChipList tags={tx.Tags} onTagClick={onTagClick} className="mt-1.5" />
                        </td>
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
                              size="icon-sm"
                              variant="outline"
                              aria-label={`Tag transaction to ${tx.Receiver}`}
                              title="Tag"
                              className="rounded-full"
                              onClick={() => setTagTargets([tx])}
                            >
                              <Tag className="size-3.5" />
                            </Button>
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
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              aria-label={`Delete transaction to ${tx.Receiver}`}
                              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(tx)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
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
          classificationCategories={classificationCategories}
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

      {tagTargets ? (
        <TagTransactionsDialog
          open={Boolean(tagTargets)}
          onOpenChange={(open) => {
            if (!open) {
              setTagTargets(null)
            }
          }}
          transactions={tagTargets}
          knownTags={knownTags}
          onSuccess={refetch}
        />
      ) : null}

      {renameTarget ? (
        <RenameReceiverDialog
          open={Boolean(renameTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setRenameTarget(null)
            }
          }}
          transaction={renameTarget}
          matchingCount={receiverCounts.get(getReceiverKey(renameTarget.Receiver ?? "")) ?? 1}
          onSuccess={refetch}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteTransactionDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null)
            }
          }}
          transaction={deleteTarget}
          onSuccess={refetch}
        />
      ) : null}
    </>
  )
}

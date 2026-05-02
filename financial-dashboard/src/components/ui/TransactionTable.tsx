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
import { Transaction } from "@/types/Transaction"
import {
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

export function TransactionTable({
  data,
  refetch,
  rangeLabel,
  activeClassification,
  hasActiveClassificationFilter = false,
  onResetFilters,
}: TransactionTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [reclassifyTarget, setReclassifyTarget] = React.useState<Transaction | null>(null)
  const [normalizeTarget, setNormalizeTarget] = React.useState<Transaction | null>(null)

  const sortedRows = React.useMemo(() => {
    const sorted = [...data].sort(
      (a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()
    )
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
  }, [data])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))

  React.useEffect(() => {
    setCurrentPage(1)
  }, [data])

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedRows.slice(start, start + PAGE_SIZE)
  }, [currentPage, sortedRows])

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
              <div className="overflow-hidden rounded-2xl border border-border/70 sm:overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="hidden bg-muted/40 text-left text-muted-foreground sm:table-header-group">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Receiver</th>
                      <th className="px-4 py-3 font-medium">Classification</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
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
                              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
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
                          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
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

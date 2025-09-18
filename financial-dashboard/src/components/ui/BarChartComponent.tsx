'use client'

import * as React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  CartesianGrid,
} from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Transaction } from "@/types/Transaction"
import { Toaster } from "@/components/ui/sonner"
import { TransactionItem } from "./TransactionItem"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export function BarChartComponent({
  data,
  refetch,
}: {
  data: Transaction[]
  refetch: () => void
}) {
  const grouped = React.useMemo(() => {
    const map: Record<string, number> = {}
    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      map[tx.Classification] = (map[tx.Classification] || 0) + amt
    })
    return Object.entries(map)
      .map(([Classification, total]) => ({
        Classification,
        total,
      }))
      .sort((a, b) => b.total - a.total) // sort descending
  }, [data])

  const [selected, setSelected] = React.useState<{
    classification: string
    total: number
  } | null>(null)

  const filtered = React.useMemo(
    () =>
      selected
        ? data.filter((d) => d.Classification === selected.classification)
        : [],
    [selected, data]
  )

  // 🔑 dynamic chart height: 50px per bar, minimum 200px, maximum 600px
//   const dynamicHeight = React.useMemo(() => {
//     if (!grouped.length) return 200
//     return Math.min(Math.max(grouped.length * 50, 200), 600)
//   }, [grouped])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Classification (Bar)</CardTitle>
      </CardHeader>

      <CardContent>
<div className="w-full overflow-x-auto">
  <div style={{ minWidth: Math.max(grouped.length * 80, 600), height: 600 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={grouped}
        margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="Classification"
          angle={-45}
          textAnchor="end"
          interval={0}
          height={80}
        />
        <YAxis />
        <Tooltip />
        <Bar
          dataKey="total"
          fill="#1f77b4"
          minPointSize={6}
          onClick={(entry) =>
            setSelected({
              classification: entry.Classification,
              total: entry.total,
            })
          }
        >
          <LabelList dataKey="total" position="top" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>
        {selected && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">
                Transactions for: {selected.classification}
              </h4>
              <p className="text-sm text-muted-foreground">
                Total: <strong>₹{selected.total.toFixed(2)}</strong>
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drilldown transaction list */}
            <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {filtered.map((tx, i) => (
                <TransactionItem key={i} tx={tx} refetch={refetch} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <Toaster />
    </Card>
  )
}
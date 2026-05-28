"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatTransactionDateKey, getTransactionDateKey } from "@/lib/transactionDate"
import { Transaction } from "@/types/Transaction"

export const description = "A bar chart with a custom label"

const chartConfig = {
  total: {
    label: "Total Spend",
    color: "var(--chart-2)",
  },
  label: {
    color: "var(--primary-foreground)",
  },
} satisfies ChartConfig

export function VerticalBarChart({
  data = [],
  activeClassification,
  onClassificationSelect,
}: {
  data: Transaction[]
  activeClassification?: string | null
  onClassificationSelect: (classification: string) => void
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
      .sort((a, b) => b.total - a.total)
  }, [data])

  const pageSize = 5
  const [currentPage, setCurrentPage] = React.useState(0)

  React.useEffect(() => {
    setCurrentPage(0)
  }, [data])

  const totalPages = Math.max(1, Math.ceil(grouped.length / pageSize))
  const startIdx = currentPage * pageSize
  const paginated = grouped.slice(startIdx, startIdx + pageSize)
  const hasActiveClassification = Boolean(activeClassification)

  const dateRange = React.useMemo(() => {
    if (!data || data.length === 0) return null
    const dates = data
      .map((tx) => getTransactionDateKey(tx.Date))
      .sort((left, right) => left.localeCompare(right))

    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]

    if (!minDate || !maxDate) {
      return null
    }

    return {
      from: formatTransactionDateKey(minDate, true),
      to: formatTransactionDateKey(maxDate, true),
    }
  }, [data])

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>Category Ranking</CardTitle>
        <CardDescription>
          {dateRange
            ? `${dateRange.from} to ${dateRange.to}`
            : "No transactions in the selected range"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="overflow-y-auto">
          <BarChart
            accessibilityLayer
            data={paginated}
            layout="vertical"
            margin={{
              right: 16,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="Classification"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
              hide
            />
            <XAxis
              dataKey="total"
              type="number"
              scale="log"
              domain={[1, "auto"]}
              padding={{ right: 40 }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="total"
              fill="var(--color-total)"
              radius={4}
              onClick={(_, index) => {
                const item = paginated[index]
                if (!item) return
                onClassificationSelect(item.Classification)
              }}
            >
              {paginated.map((item) => {
                const isActive = activeClassification === item.Classification
                return (
                  <Cell
                    key={item.Classification}
                    fill="var(--color-total)"
                    fillOpacity={hasActiveClassification && !isActive ? 0.35 : 1}
                  />
                )
              })}
              <LabelList
                dataKey="Classification"
                position="insideLeft"
                offset={8}
                className="fill-(--color-label)"
                fontSize={12}
              />
              <LabelList
                dataKey="total"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages - 1}
              onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages - 1))}
            >
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

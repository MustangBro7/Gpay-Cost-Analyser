"use client"

import { CartesianGrid, Line, LineChart, XAxis, Brush } from "recharts"
import * as React from "react"
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

const chartConfig = {
  total: {
    label: "Total Spend",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function GlowingLineChart({ data }: { data?: Transaction[] }) {
  const daily = React.useMemo(() => {
    if (!data || data.length === 0) return []

    const map: Record<string, number> = {}

    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      const date = getTransactionDateKey(tx.Date)
      map[date] = (map[date] || 0) + amt
    })

    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  const rangeLabel = React.useMemo(() => {
    if (daily.length === 0) {
      return "No transactions in the selected range"
    }

    return `${formatTransactionDateKey(daily[0].date)} to ${formatTransactionDateKey(
      daily[daily.length - 1].date
    )}`
  }, [daily])

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>Daily Spend Trend</CardTitle>
        <CardDescription>{rangeLabel}</CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={daily}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => formatTransactionDateKey(String(value))}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent />}
            />
            <Line
              dataKey="total"
              type="monotone"
              stroke="var(--chart-2)"
              dot={false}
              strokeWidth={2}
              filter="url(#rainbow-line-glow)"
            />
              <Brush
    dataKey="date"
    height={30}
    stroke="var(--chart-2)"
    travellerWidth={10}
    // padding= "5px"
    tickFormatter={(value) => formatTransactionDateKey(String(value))}
  />
            <defs>
              <filter
                id="rainbow-line-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

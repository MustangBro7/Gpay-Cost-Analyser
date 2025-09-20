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

// import { TrendingUp } from "lucide-react"
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
      const date = new Date(tx.Date).toISOString().split("T")[0] // YYYY-MM-DD
      map[date] = (map[date] || 0) + amt
    })

    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Daily Spend Trend
        </CardTitle>
        <CardDescription>Showing daily total spend</CardDescription>
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
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
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
    tickFormatter={(value) =>
      new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    }
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
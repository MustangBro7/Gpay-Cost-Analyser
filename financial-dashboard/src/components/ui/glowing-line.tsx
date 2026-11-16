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
import { buildGroupColors, NEUTRAL_CHART_COLOR, type GroupColorFn } from "@/lib/chartColors"
import { formatGroupLabel, getGroupKeys, groupTotals } from "@/lib/tags"
import { formatTransactionDateKey, getTransactionDateKey } from "@/lib/transactionDate"
import { GroupBy } from "@/types/Tag"
import { Transaction } from "@/types/Transaction"

const chartConfig = {
  total: {
    label: "Total Spend",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

/** Lines drawn before the rest fold into "Other tags". */
const MAX_SERIES = 5

type Series = { dataKey: string; label: string; color: string; groups: string[] }

/** One line per tag (top four plus "Other tags"), so separate events stay distinguishable. */
function buildTagSeries(data: Transaction[], colorFor?: GroupColorFn): Series[] {
  const ranked = Array.from(groupTotals(data, "tag").entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([key]) => key)
  const getColor = colorFor ?? buildGroupColors(ranked)
  const limit = ranked.length > MAX_SERIES ? MAX_SERIES - 1 : ranked.length
  const series: Series[] = ranked.slice(0, limit).map((key, index) => ({
    dataKey: `s${index}`,
    label: formatGroupLabel(key),
    color: getColor(key),
    groups: [key],
  }))
  if (ranked.length > limit) {
    series.push({
      dataKey: `s${limit}`,
      label: "Other tags",
      color: NEUTRAL_CHART_COLOR,
      groups: ranked.slice(limit),
    })
  }
  return series
}

export function GlowingLineChart({
  data,
  groupBy = "classification",
  colorFor,
}: {
  data?: Transaction[]
  /** In tag view, draws one line per tag instead of a single total. */
  groupBy?: GroupBy
  /** Stable per-tag colors shared with the other widgets. */
  colorFor?: GroupColorFn
}) {
  const series = React.useMemo<Series[] | null>(() => {
    if (groupBy !== "tag" || !data || data.length === 0) {
      return null
    }
    const tagSeries = buildTagSeries(data, colorFor)
    return tagSeries.length > 1 ? tagSeries : null
  }, [colorFor, data, groupBy])

  const daily = React.useMemo(() => {
    if (!data || data.length === 0) return []

    const map: Record<string, Record<string, number>> = {}

    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      const date = getTransactionDateKey(tx.Date)
      const row = (map[date] ??= {})
      if (!series) {
        row.total = (row.total || 0) + amt
        return
      }
      // A transaction counts once per line, even if several of its tags fold into "Other tags".
      const lines = new Set(
        getGroupKeys(tx, "tag")
          .map((key) => series.find((entry) => entry.groups.includes(key))?.dataKey)
          .filter((key): key is string => Boolean(key))
      )
      lines.forEach((key) => {
        row[key] = (row[key] || 0) + amt
      })
    })

    return Object.entries(map)
      .map(([date, totals]) => {
        const row: Record<string, string | number> = { date }
        if (series) {
          series.forEach((entry) => {
            row[entry.dataKey] = totals[entry.dataKey] ?? 0
          })
        } else {
          row.total = totals.total ?? 0
        }
        return row
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [data, series])

  const activeConfig = React.useMemo<ChartConfig>(() => {
    if (!series) {
      return chartConfig
    }
    return Object.fromEntries(
      series.map((entry) => [entry.dataKey, { label: entry.label, color: entry.color }])
    )
  }, [series])

  const rangeLabel = React.useMemo(() => {
    if (daily.length === 0) {
      return "No transactions in the selected range"
    }

    return `${formatTransactionDateKey(String(daily[0].date))} to ${formatTransactionDateKey(
      String(daily[daily.length - 1].date)
    )}`
  }, [daily])

  return (
    <Card className="flex h-full flex-col rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle>{groupBy === "tag" ? "Daily Spend by Tag" : "Daily Spend Trend"}</CardTitle>
        <CardDescription>{rangeLabel}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <ChartContainer config={activeConfig} className="aspect-auto h-64 w-full sm:h-80">
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
            {series ? (
              series.map((entry) => (
                <Line
                  key={entry.dataKey}
                  dataKey={entry.dataKey}
                  type="monotone"
                  stroke={entry.color}
                  dot={false}
                  strokeWidth={2}
                  filter="url(#rainbow-line-glow)"
                />
              ))
            ) : (
              <Line
                dataKey="total"
                type="monotone"
                stroke="var(--chart-1)"
                dot={false}
                strokeWidth={2}
                filter="url(#rainbow-line-glow)"
              />
            )}
              <Brush
    dataKey="date"
    height={30}
    stroke="var(--chart-1)"
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

        {series ? (
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {series.map((entry) => (
              <li key={entry.dataKey} className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="max-w-[12rem] truncate">{entry.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

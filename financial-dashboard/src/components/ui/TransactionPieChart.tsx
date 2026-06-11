'use client'

import * as React from "react"
import { Cell, Label, Pie, PieChart } from "recharts"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

export function PieChartComponent({
  data,
  activeClassification,
  onClassificationSelect,
}: {
  data: { Classification: string; Amount: string; Receiver: string; Date: string }[]
  activeClassification?: string | null
  onClassificationSelect: (classification: string) => void
}) {
  const safeData = React.useMemo(
    () => (Array.isArray(data) ? data : []),
    [data]
  )

  const parsedData = React.useMemo(() => {
    const grouped = safeData.reduce((acc, curr) => {
      const key = curr.Classification
      const amt = parseFloat(curr.Amount.replace(/,/g, ""))
      acc[key] = (acc[key] || 0) + amt
      return acc
    }, {} as Record<string, number>)

    return Object.entries(grouped).map(([classification, amount]) => ({
      classification,
      amount,
    }))
  }, [safeData])

  const total = parsedData.reduce((acc, curr) => acc + curr.amount, 0)

  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ]

  const coloredData = parsedData.map((entry, index) => ({
    ...entry,
    fill: colors[index % colors.length],
  }))

  const chartConfig = Object.fromEntries(
    coloredData.map((entry, index) => [
      entry.classification,
      { label: entry.classification, color: colors[index % colors.length] },
    ])
  )

  const hasActiveClassification = Boolean(activeClassification)
  const legendData = [...coloredData].sort((a, b) => b.amount - a.amount)
  const formattedTotal = `₹${total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

  return (
    <Card className="flex h-full flex-col rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>Spending by Classification</CardTitle>
        <CardDescription>
          Click a slice or category to focus the dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 px-2 pb-2 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[19rem]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={coloredData}
              dataKey="amount"
              nameKey="classification"
              innerRadius="58%"
              outerRadius="85%"
              stroke="var(--background)"
              strokeWidth={6}
              onClick={(_, index) => {
                const item = coloredData[index]
                if (!item) return
                onClassificationSelect(item.classification)
              }}
            >
              {coloredData.map((entry) => {
                const isActive = activeClassification === entry.classification
                return (
                  <Cell
                    key={entry.classification}
                    fill={entry.fill}
                    fillOpacity={hasActiveClassification && !isActive ? 0.4 : 1}
                    strokeOpacity={hasActiveClassification && !isActive ? 0.55 : 1}
                  />
                )
              })}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl font-bold"
                        >
                          {formattedTotal}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                          className="fill-muted-foreground text-xs"
                        >
                          Total Spend
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="mt-auto border-t border-border/70 pt-4">
        <ul className="grid w-full grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {legendData.map((entry) => {
            const isActive = activeClassification === entry.classification
            const isDimmed = hasActiveClassification && !isActive
            return (
              <li key={entry.classification} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onClassificationSelect(entry.classification)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded-full px-1 py-0.5 text-left text-sm transition-opacity hover:opacity-100",
                    isDimmed && "opacity-50"
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="min-w-0 truncate">{entry.classification}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {total > 0 ? Math.round((entry.amount / total) * 100) : 0}%
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </CardFooter>
    </Card>
  )
}

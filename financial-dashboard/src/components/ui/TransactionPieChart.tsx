'use client'

import * as React from "react"
import { TrendingUp } from "lucide-react"
import { Cell, Label, Pie, PieChart } from "recharts"
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

  return (
    <Card className="flex h-full flex-col border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>Spending by Classification</CardTitle>
        <CardDescription>
          Compare category share and click a slice to focus the dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-2 pb-2 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[28rem]"
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
              innerRadius={92}
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
                          className="fill-foreground text-3xl font-bold"
                        >
                          ₹{total.toFixed(0)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
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

      <CardFooter className="flex flex-col items-start gap-2 border-t border-border/70 pt-5 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          You spent ₹{total.toFixed(0)} <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Based on selected date range
        </div>
      </CardFooter>
    </Card>
  )
}

'use client'

import * as React from "react"
import { TrendingUp } from "lucide-react"
import { Label, Pie, PieChart } from "recharts"
import { toast } from "sonner"
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
import { Toaster } from "@/components/ui/sonner"
import { TransactionItem } from "./TransactionItem"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
// 👇 Subcomponent for each transaction
export function TransactionItem1({
  tx,
  refetch,
}: {
  tx: { Classification: string; Amount: string; Receiver: string; Date: string }
  refetch: () => void
}){
  const [newClass, setNewClass] = React.useState("")
  const website_url = process.env.NEXT_PUBLIC_API_URL
    const handleReclassify = async () => {
      try {
        await fetch(`${website_url}/reclassify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            original: tx,
            newClassification: newClass,
          }),
        })
  
        toast("Reclassification submitted!", {
          description: `Original: "${tx.Classification}"
          New Classification: "${newClass}"`,
        })
        setNewClass("")
        refetch() // <-- Refetch data after reclassify!
      } catch (err) {
        console.error(err)
        toast("Failed to submit reclassification.")
      }
  }

  return (
    <li className="text-sm border-b pb-2 space-y-1">
      <div>
        <strong>₹{tx.Amount}</strong> to {tx.Receiver}
      </div>
      <div className="text-muted-foreground text-xs">
        {new Date(tx.Date).toLocaleString()}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          placeholder="New classification"
          value={newClass}
          onChange={(e) => setNewClass(e.target.value)}
          className="border px-2 py-1 text-xs rounded w-40"
        />
        <button
          onClick={handleReclassify}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
        >
          Reclassify
        </button>
      </div>
    </li>
  )
}

export function PieChartComponent({
  data,
  refetch,
}: {
  data: { Classification: string; Amount: string; Receiver: string; Date: string }[]
  refetch: () => void
}){
  const parsedData = React.useMemo(() => {
    const grouped = data.reduce((acc, curr) => {
      const key = curr.Classification
      const amt = parseFloat(curr.Amount.replace(/,/g, ""))
      acc[key] = (acc[key] || 0) + amt
      return acc
    }, {} as Record<string, number>)

    return Object.entries(grouped).map(([classification, amount]) => ({
      classification,
      amount,
    }))
  }, [data])

  const total = parsedData.reduce((acc, curr) => acc + curr.amount, 0)

  const colors = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173",
    "#3182bd", "#f33f3f", "#6baed6", "#9e9ac8", "#31a354",
    "#ff69b4", "#a0522d", "#b0c4de", "#ffa500", "#40e0d0",
    "#9acd32", "#ff6347", "#4682b4", "#00fa9a", "#dda0dd",
    "#ff1493", "#7fffd4", "#cd5c5c", "#6a5acd", "#00bfff",
    "#f0e68c", "#dc143c", "#00ced1", "#8fbc8f", "#b22222",
    "#ffdead", "#a9a9a9", "#20b2aa", "#db7093", "#556b2f",
    "#ffe4c4", "#708090", "#ff4500", "#2f4f4f", "#deb887",
    "#ffdab9", "#483d8b"
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

  const [selected, setSelected] = React.useState<{ classification: string; amount: number } | null>(null)

  const filteredTransactions = React.useMemo(() => {
    if (!selected) return []
    return data.filter((d) => d.Classification === selected.classification)
  }, [selected, data])
  {filteredTransactions.map((tx, idx) => (
    <TransactionItem key={idx} tx={tx} refetch={refetch} />
  ))}
  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Spending by Classification</CardTitle>
        <CardDescription>Date range selected</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[750px]"
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
              innerRadius={100}
              strokeWidth={10}
              onClick={(entry) =>
                setSelected({
                  classification: entry.classification,
                  amount: entry.amount,
                })
              }
            >
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

      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          You spent ₹{total.toFixed(0)} <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Based on selected date range
        </div>
      </CardFooter>

      {selected && (
        <div className="mt-4 border-t pt-4 px-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold">
              Transactions for: {selected.classification}
            </h4>
            <p className="text-sm text-muted-foreground">
              Total: <strong>₹{selected.amount.toFixed(2)}</strong>
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
          <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {filteredTransactions.map((tx, idx) => (
              <TransactionItem key={idx} tx={tx} refetch={refetch} />
            ))}
          </ul>
        </div>
      )}
      <Toaster />
    </Card>
    
  )
}

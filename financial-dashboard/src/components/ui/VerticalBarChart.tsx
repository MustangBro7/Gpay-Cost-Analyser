
"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

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
// import { TransactionItem } from "./TransactionItem"
import * as React from "react"
import { Transaction } from "@/types/Transaction"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { TransactionItem } from "./TransactionItem" 
import { format } from "date-fns"

export const description = "A bar chart with a custom label"

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-2)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
  label: {
    color: "var(--background)",
  },
} satisfies ChartConfig

export function VerticalBarChart({
  data = [], // 👈 default fallback so it's never undefined
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

  // --- Pagination ---
  const pageSize = 5
  const [currentPage, setCurrentPage] = React.useState(0)

  const totalPages = Math.ceil(grouped.length / pageSize)
  const startIdx = currentPage * pageSize
  const paginated = grouped.slice(startIdx, startIdx + pageSize)
  const dateRange = React.useMemo(() => {
  if (!data || data.length === 0) return null
  const dates = data.map((tx) => new Date(tx.Date))
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
  return {
    from: format(minDate, "d MMM yyyy"), // e.g. "5 Jan 2024"
    to: format(maxDate, "d MMM yyyy"),   // e.g. "21 Jun 2024"
  }
}, [data])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Classification (Bar)</CardTitle>
        <CardDescription>  {dateRange
    ? `${dateRange.from} → ${dateRange.to}`
    : "No transactions in selected range"}</CardDescription>
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
            <XAxis dataKey="total" type="number" scale="log" domain={[ 1, 'auto']} padding={{ right: 40 }}/>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="total"
              layout="vertical"
              fill="var(--color-desktop)"
              radius={4}
               onClick={(entry) =>
            setSelected({
              classification: entry.Classification,
              total: entry.total,
            })
        }
            >
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
                {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
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
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages - 1))
              }
            >
              Next
            </Button>
          </div>
        )}
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
    </Card>
  )
}

// "use client"

// import { TrendingUp } from "lucide-react"
// import {
//   Bar,
//   BarChart,
//   CartesianGrid,
//   LabelList,
//   XAxis,
//   YAxis,
// } from "recharts"

// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card"
// import {
//   ChartConfig,
//   ChartContainer,
//   ChartTooltip,
// //   ChartTooltipContent,
// } from "@/components/ui/chart"
// import * as React from "react"
// import { Transaction } from "@/types/Transaction"

// export const description = "A bar chart with classifications"

// const chartConfig = {
//   total: {
//     label: "Total Spend",
//     color: "var(--chart-2)",
//   },
// } satisfies ChartConfig

// export function VerticalBarChart({
//   data = [], // 👈 default fallback so it's never undefined
// }: {
//   data?: Transaction[]
//   refetch?: () => void
// }) {
//   // group by classification
//   const grouped = React.useMemo(() => {
//     if (!data || data.length === 0) return []

//     const map: Record<string, number> = {}
//     data.forEach((tx) => {
//       const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
//       map[tx.Classification] = (map[tx.Classification] || 0) + amt
//     })
//     return Object.entries(map)
//       .map(([Classification, total]) => ({
//         Classification,
//         total,
//       }))
//       .sort((a, b) => b.total - a.total) // sort descending
//   }, [data])

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Spending by Classification</CardTitle>
//         <CardDescription>Date range selected</CardDescription>
//       </CardHeader>
//       <CardContent>
//         <ChartContainer config={chartConfig}>
//           <BarChart
//             accessibilityLayer
//             data={grouped}
//             layout="vertical"
//             margin={{ right: 16 }}
//           >
//             <CartesianGrid horizontal={false} />
//             <YAxis
//               dataKey="Classification"
//               type="category"
//               tickLine={false}
//               tickMargin={10}
//               axisLine={false}
//               width={100}
//             />
//             <XAxis dataKey="total" type="number" hide />
//             <ChartTooltip
//               cursor={false}
//             //   content={({ active, payload }) => {
//             //     if (active && payload && payload.length) {
//             //       const entry = payload[0]
//             //       return (
//             //         <div className="rounded-md bg-background p-2 shadow border">
//             //           <div className="text-xs text-muted-foreground">
//             //             {entry.payload.Classification}
//             //           </div>
//             //           <div className="font-medium text-foreground">
//             //             ₹{entry.value?.toLocaleString()}
//             //           </div>
//             //         </div>
//             //       )
//             //     }
//             //     return null
//             //   }}
//             />
//             <Bar
//               dataKey="total"
//               layout="vertical"
//               fill="var(--color-total)"
//               radius={4}
//             >
//               <LabelList
//                 dataKey="Classification"
//                 position="insideLeft"
//                 offset={8}
//                 className="fill-muted-foreground"
//                 fontSize={12}
//               />
//               <LabelList
//                 dataKey="total"
//                 position="right"
//                 offset={8}
//                 className="fill-foreground"
//                 fontSize={12}
//                 formatter={(val: number) => `₹${val.toLocaleString()}`}
//               />
//             </Bar>
//           </BarChart>
//         </ChartContainer>
//       </CardContent>
//       <CardFooter className="flex-col items-start gap-2 text-sm">
//         <div className="flex gap-2 leading-none font-medium">
//           Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
//         </div>
//         <div className="text-muted-foreground leading-none">
//           Based on selected date range
//         </div>
//       </CardFooter>
//     </Card>
//   )
// }
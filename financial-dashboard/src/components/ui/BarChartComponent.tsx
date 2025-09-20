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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Classification (Bar)</CardTitle>
      </CardHeader>

      <CardContent className="px-2 sm:px-6 py-2 sm:py-4">
<div className="w-full overflow-x-auto">
<div
  className="h-[320px] sm:h-[500px] lg:h-[600px]"
  style={{
    minWidth: grouped.length <= 7 ? "100%" : grouped.length * 80,
  }}
>
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
  tick={{ className: "hidden sm:block" }} // 👈 hides labels on mobile
  axisLine={true}
  tickLine={true}
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
// "use client"

// import * as React from "react"
// import { TrendingUp, X } from "lucide-react"
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
//   ChartContainer,
//   ChartTooltip,
//   ChartTooltipContent,
// } from "@/components/ui/chart"
// import { Button } from "@/components/ui/button"
// import { Toaster } from "@/components/ui/sonner"
// import { TransactionItem } from "./TransactionItem"

// export function BarChartComponent({
//   data,
//   refetch,
// }: {
//   data: {
//     Classification: string
//     Amount: string
//     Receiver: string
//     Date: string
//   }[]
//   refetch: () => void
// }) {
//   // Group by classification like in PieChart
//   const parsedData = React.useMemo(() => {
//     const grouped = data.reduce((acc, curr) => {
//       const key = curr.Classification
//       const amt = parseFloat(curr.Amount.replace(/,/g, ""))
//       acc[key] = (acc[key] || 0) + amt
//       return acc
//     }, {} as Record<string, number>)

//     return Object.entries(grouped).map(([classification, amount]) => ({
//       classification,
//       amount,
//     }))
//   }, [data])

//   const total = parsedData.reduce((acc, curr) => acc + curr.amount, 0)

//   const [selected, setSelected] = React.useState<{
//     classification: string
//     amount: number
//   } | null>(null)

//   // Transactions filtered by selection
//   const filteredTransactions = React.useMemo(() => {
//     if (!selected) return []
//     return data.filter((d) => d.Classification === selected.classification)
//   }, [selected, data])

//   return (
//     <Card className="flex flex-col">
//       <CardHeader>
//         <CardTitle>Spending by Classification (Bar)</CardTitle>
//         <CardDescription>Date range selected</CardDescription>
//       </CardHeader>

//       <CardContent>
//         <ChartContainer
//           config={Object.fromEntries(
//             parsedData.map((d) => [
//               d.classification,
//               { label: d.classification, color: "var(--chart-2)" },
//             ])
//           )}
//         >
//           <BarChart
//             accessibilityLayer
//             data={parsedData}
//             layout="vertical"
//             margin={{ right: 16 }}
//           >
//             <CartesianGrid horizontal={false} />
//             <YAxis
//               dataKey="classification"
//               type="category"
//               tickLine={false}
//               tickMargin={10}
//               axisLine={false}
//             />
//             <XAxis dataKey="amount" type="number" hide />
//             <ChartTooltip
//               cursor={false}
//               content={<ChartTooltipContent indicator="line" />}
//             />
//             <Bar
//               dataKey="amount"
//               layout="vertical"
//               fill="var(--color-desktop)"
//               radius={4}
//               onClick={(entry) =>
//                 setSelected({
//                   classification: entry.classification,
//                   amount: entry.amount,
//                 })
//               }
//             >
//               <LabelList
//                 dataKey="classification"
//                 position="insideLeft"
//                 offset={8}
//                 className="fill-muted-foreground"
//                 fontSize={12}
//               />
//               <LabelList
//                 dataKey="amount"
//                 position="right"
//                 offset={8}
//                 className="fill-foreground"
//                 fontSize={12}
//               />
//             </Bar>
//           </BarChart>
//         </ChartContainer>
//       </CardContent>

//       <CardFooter className="flex-col gap-2 text-sm">
//         <div className="flex items-center gap-2 font-medium leading-none">
//           You spent ₹{total.toFixed(0)} <TrendingUp className="h-4 w-4" />
//         </div>
//         <div className="leading-none text-muted-foreground">
//           Based on selected date range
//         </div>
//       </CardFooter>

//       {selected && (
//         <div className="mt-4 border-t pt-4 px-6">
//           <div className="flex items-center justify-between mb-2">
//             <h4 className="text-lg font-semibold">
//               Transactions for: {selected.classification}
//             </h4>
//             <p className="text-sm text-muted-foreground">
//               Total: <strong>₹{selected.amount.toFixed(2)}</strong>
//             </p>
//             <Button
//               size="icon"
//               variant="ghost"
//               className="h-6 w-6 text-muted-foreground hover:text-foreground"
//               onClick={() => setSelected(null)}
//             >
//               <X className="h-4 w-4" />
//             </Button>
//           </div>
//           <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
//             {filteredTransactions.map((tx, idx) => (
//               <TransactionItem key={idx} tx={tx} refetch={refetch} />
//             ))}
//           </ul>
//         </div>
//       )}

//       <Toaster />
//     </Card>
//   )
// }
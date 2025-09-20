// 'use client'

// import * as React from "react"
// import { DateRangeForm } from "../components/ui/DateRangeForm"
// import { PieChartComponent } from "../components/ui/TransactionPieChart"
// import { Toaster } from "@/components/ui/sonner"
// import { Transaction } from "@/types/Transaction"

// export default function Home() {
//   const [data, setData] = React.useState<Transaction[]>([])
//   const [dateRange, setDateRange] = React.useState<{from: Date, to: Date} | null>(null)
//   const website_url = process.env.NEXT_PUBLIC_API_URL
//   // Fetch data for a given date range
//   const fetchData = React.useCallback(async (range: {from: Date, to: Date}) => {
//     const response = await fetch(`${website_url}/daterange`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         startDate: range.from.toISOString().split('T')[0],
//         endDate: range.to.toISOString().split('T')[0],
//       })
//     })
//     const data = await response.json()
//     console.log(data)
//     setData(data)
//   }, [website_url])

//   // Called by DateRangeForm
//   const handleDataFetched = (data: Transaction[], range: { from: Date; to: Date }) => {
//     setData(data)
//     setDateRange(range)
//   }

//   // Refetch using the last date range
//   const refetch = React.useCallback(() => {
//     if (dateRange) {
//       fetchData(dateRange)
//     }
//   }, [dateRange, fetchData])

//   return (
//     <main className="flex min-h-screen flex-col items-center justify-center p-24 space-y-6">
//       <DateRangeForm onDataFetched={handleDataFetched} />
//       <div className="w-full max-w-lg">
//         <PieChartComponent data={data} refetch={refetch} />
//       </div>
//       <Toaster />
//     </main>
//   )
// }

'use client'

import * as React from "react"
import { DateRangeForm } from "../components/ui/DateRangeForm"
import { PieChartComponent } from "../components/ui/TransactionPieChart"
// import { BarChartComponent } from "../components/ui/BarChartComponent"
// import { LineChartComponent } from "../components/ui/LineChartComponent"
import { Toaster } from "@/components/ui/sonner"
import { Transaction } from "@/types/Transaction"
import { GlowingLineChart } from "@/components/ui/glowing-line"
import { VerticalBarChart }  from "@/components/ui/VerticalBarChart"
export default function Home() {
  const [data, setData] = React.useState<Transaction[]>([])
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date } | null>(null)
  const website_url = process.env.NEXT_PUBLIC_API_URL

  const fetchData = React.useCallback(async (range: { from: Date; to: Date }) => {
    const response = await fetch(`${website_url}/daterange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: range.from.toISOString().split("T")[0],
        endDate: range.to.toISOString().split("T")[0],
      }),
    })
    const data = await response.json()
    setData(data)
  }, [website_url])

  const handleDataFetched = (data: Transaction[], range: { from: Date; to: Date }) => {
    setData(data)
    setDateRange(range)
  }

  const refetch = React.useCallback(() => {
    if (dateRange) fetchData(dateRange)
  }, [dateRange, fetchData])

  return (
    <main className="flex flex-col items-center justify-center p-6 space-y-6 w-full">
      <DateRangeForm onDataFetched={handleDataFetched} />

      {/* Responsive dashboard layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <PieChartComponent data={data} refetch={refetch} />
        
        <div className="flex flex-col space-y-6">
          <VerticalBarChart data={data} refetch={refetch}/>
          <GlowingLineChart data={data}/>
        </div>
      </div>

      <Toaster />
    </main>
  )
}
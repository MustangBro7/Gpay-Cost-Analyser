// import { DateRangeForm } from "../components/ui/DateRangeForm"
// export default function Home() {
//   return (
//     <main className="flex min-h-screen flex-col items-center justify-center p-24">
//       <DateRangeForm />
//     </main>
//   )
// }

// 'use client'

// import * as React from "react"
// import { DateRangeForm } from "../components/ui/DateRangeForm"
// import { PieChartComponent } from "../components/ui/TransactionPieChart"
// export default function Home() {
//   const [data, setData] = React.useState<any[]>([])

//   return (
//     <main className="flex min-h-screen flex-col items-center justify-center p-24 space-y-6">
//       <DateRangeForm onDataFetched={setData} />

//       {/* Render the data here */}
//       <div className="w-full max-w-md space-y-2">
//         {data.length === 0 ? (
//           <p className="text-muted-foreground text-sm">No data loaded.</p>
//         ) : (
//           data.map((tx, i) => (
//             <div key={i} className="border rounded p-2 bg-white shadow-sm">
//               <p><strong>Amount:</strong> ₹{tx.Amount}</p>
//               <p><strong>Classification:</strong> {tx.Classification}</p>
//               <p><strong>Receiver:</strong> {tx.Receiver}</p>
//               <p><strong>Date:</strong> {tx.Date}</p>
//             </div>
//           ))
//         )}
//       </div>
//       <PieChartComponent />
//     </main>
//   )
// }

// 'use client'

// import * as React from "react"
// import { DateRangeForm } from "../components/ui/DateRangeForm"
// import { PieChartComponent } from "../components/ui/TransactionPieChart"

// export default function Home() {
//   const [data, setData] = React.useState<any[]>([])

//   // Transform the data into pie chart format
//   const chartData = React.useMemo(() => {
//     const grouped: Record<string, number> = {}

//     for (const entry of data) {
//       const classification = entry.Classification || "Uncategorized"
//       const amount = parseFloat(entry.Amount) || 0

//       if (!grouped[classification]) {
//         grouped[classification] = 0
//       }
//       grouped[classification] += amount
//     }

//     return Object.entries(grouped).map(([classification, total]) => ({
//       classification,
//       amount: total,
//     }))
//   }, [data])

//   return (
//     <main className="flex min-h-screen flex-col items-center justify-center p-24 space-y-6">
//       <DateRangeForm onDataFetched={setData} />

//       <div className="w-full max-w-lg">
//         <PieChartComponent data={chartData} />
//       </div>
//     </main>
//   )
// }

// 'use client'

// import * as React from "react"
// import { DateRangeForm } from "../components/ui/DateRangeForm"
// import { PieChartComponent } from "../components/ui/TransactionPieChart"
// import { Toaster } from "@/components/ui/sonner"

// export default function Home() {
//   const [data, setData] = React.useState<any[]>([])

//   return (
//     <main className="flex min-h-screen flex-col items-center justify-center p-24 space-y-6">
//       <DateRangeForm onDataFetched={setData} />

//       <div className="w-full max-w-lg">
//         <PieChartComponent data={data} /> {/* ✅ pass raw data */}
//       </div>
//       <Toaster />
//     </main>
//   )
// }

// page.tsx
'use client'

import * as React from "react"
import { DateRangeForm } from "../components/ui/DateRangeForm"
import { PieChartComponent } from "../components/ui/TransactionPieChart"
import { Toaster } from "@/components/ui/sonner"

export default function Home() {
  const [data, setData] = React.useState<any[]>([])
  const [dateRange, setDateRange] = React.useState<{from: Date, to: Date} | null>(null)
  const website_url = process.env.NEXT_PUBLIC_API_URL
  console.log("API URL:", website_url)
  // Fetch data for a given date range
  const fetchData = React.useCallback(async (range: {from: Date, to: Date}) => {
    const response = await fetch(`${website_url}/daterange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: range.from.toISOString().split('T')[0],
        endDate: range.to.toISOString().split('T')[0],
      })
    })
    const data = await response.json()
    console.log(data)
    setData(data)
  }, [])

  // Called by DateRangeForm
  const handleDataFetched = (data: any[], range: {from: Date, to: Date}) => {
    setData(data)
    setDateRange(range)
  }

  // Refetch using the last date range
  const refetch = React.useCallback(() => {
    if (dateRange) {
      fetchData(dateRange)
    }
  }, [dateRange, fetchData])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 space-y-6">
      <DateRangeForm onDataFetched={handleDataFetched} />
      <div className="w-full max-w-lg">
        <PieChartComponent data={data} refetch={refetch} />
      </div>
      <Toaster />
    </main>
  )
}

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
import { ClassificationFilter } from "@/components/ui/ClassificationFilter"

export default function Home() {
  const [data, setData] = React.useState<Transaction[]>([])
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date } | null>(null)
  const [selectedClassifications, setSelectedClassifications] = React.useState<Set<string>>(new Set())
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

  // Filter data based on selected classifications
  const filteredData = React.useMemo(() => {
    if (selectedClassifications.size === 0) return data
    return data.filter((tx) => selectedClassifications.has(tx.Classification))
  }, [data, selectedClassifications])

  return (
    <main className="flex flex-col items-center justify-center p-6 space-y-6 w-full">
      <DateRangeForm onDataFetched={handleDataFetched} />
      
      {/* Classification Filter */}
      {data.length > 0 && (
        <ClassificationFilter
          data={data}
          selectedClassifications={selectedClassifications}
          onSelectionChange={setSelectedClassifications}
        />
      )}

      {/* Responsive dashboard layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <PieChartComponent data={filteredData} refetch={refetch} />
        
        <div className="flex flex-col space-y-6">
          <VerticalBarChart data={filteredData} refetch={refetch}/>
          <GlowingLineChart data={filteredData}/>
        </div>
      </div>

      <Toaster />
    </main>
  )
}
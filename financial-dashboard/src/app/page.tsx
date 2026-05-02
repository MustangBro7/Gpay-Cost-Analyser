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
import { AddTransactionDialog } from "@/components/ui/AddTransactionDialog"
import { ReauthWarning } from "@/components/ui/ReauthWarning"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton"
import { AppSignedIn, AppSignedOut, useAppUser } from "@/lib/auth"
import { formatLocalDate } from "@/lib/utils"
import { isAuthTokenUnavailableError, useAuthedFetch } from "@/lib/useAuthedFetch"
import { Plus } from "lucide-react"

function normalizeTransactions(payload: unknown): Transaction[] {
  return Array.isArray(payload) ? (payload as Transaction[]) : []
}

export default function Home() {
  const [data, setData] = React.useState<Transaction[]>([])
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date } | null>(null)
  const [selectedClassifications, setSelectedClassifications] = React.useState<Set<string>>(new Set())
  const [isInitialLoad, setIsInitialLoad] = React.useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const website_url = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()
  const { user, isLoaded } = useAppUser()

  const fetchData = React.useCallback(async (range: { from: Date; to: Date }) => {
    if (!website_url) {
      setData([])
      setIsInitialLoad(false)
      return
    }

    let response: Response
    try {
      response = await authedFetch(`${website_url}/daterange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: formatLocalDate(range.from),
          endDate: formatLocalDate(range.to),
        }),
      })
    } catch (error) {
      if (isAuthTokenUnavailableError(error)) {
        setData([])
        return
      }
      throw error
    }

    if (!response.ok) {
      if (response.status === 401) {
        setData([])
        return
      }
      throw new Error(`Failed to fetch transactions: ${response.status}`)
    }

    const payload = await response.json()
    setData(normalizeTransactions(payload))
    setIsInitialLoad(false)
  }, [authedFetch, website_url])

  // Auto-load this month's data on initial page load
  React.useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (isInitialLoad && user) {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      
      const initialRange = { from: startOfMonth, to: endOfMonth }
      setDateRange(initialRange)
      fetchData(initialRange).catch((error) => {
        console.error('Failed to fetch initial transactions:', error)
        setData([])
        setIsInitialLoad(false)
      })
      return
    }

    if (isInitialLoad && !user) {
      setData([])
      setIsInitialLoad(false)
    }
  }, [isInitialLoad, fetchData, isLoaded, user])

  const handleDataFetched = React.useCallback((data: Transaction[], range: { from: Date; to: Date }) => {
    setData(normalizeTransactions(data))
    setDateRange(range)
    setIsInitialLoad(false)
  }, [])

  const refetch = React.useCallback(() => {
    if (dateRange) fetchData(dateRange)
  }, [dateRange, fetchData])

  // Filter data based on selected classifications
  const filteredData = React.useMemo(() => {
    if (selectedClassifications.size === 0) return data
    return data.filter((tx) => selectedClassifications.has(tx.Classification))
  }, [data, selectedClassifications])

  return (
    <>
      <AppSignedOut>
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-semibold">Sign in to continue</h1>
            <GoogleSignInButton />
          </div>
        </main>
      </AppSignedOut>

      <AppSignedIn>
      {/* Re-authentication Warning - shows when token is expiring */}
      <ReauthWarning userId={user?.id} userEmail={user?.primaryEmailAddress?.emailAddress ?? undefined} />
      
      <main className="flex flex-col items-center justify-center px-4 py-6 sm:p-6 space-y-5 sm:space-y-6 w-full max-w-7xl mx-auto">
        {/* Header section with date picker and add button */}
        <div className="w-full">
          <DateRangeForm
            onDataFetched={handleDataFetched}
            actions={
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="gap-2 w-full sm:w-auto h-11"
              >
                <Plus className="h-4 w-4" />
                Add Transaction
              </Button>
            }
          />
        </div>

        <AddTransactionDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSuccess={refetch}
        />
        
        {/* Classification Filter */}
        {data.length > 0 && (
          <div className="w-full">
            <ClassificationFilter
              data={data}
              selectedClassifications={selectedClassifications}
              onSelectionChange={setSelectedClassifications}
            />
          </div>
        )}

        {/* Responsive dashboard layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full">
          <PieChartComponent data={filteredData} refetch={refetch} />
          
          <div className="flex flex-col space-y-5 sm:space-y-6">
            <VerticalBarChart data={filteredData} refetch={refetch}/>
            <GlowingLineChart data={filteredData}/>
          </div>
        </div>

        <Toaster />
      </main>
      </AppSignedIn>
    </>
  )
}

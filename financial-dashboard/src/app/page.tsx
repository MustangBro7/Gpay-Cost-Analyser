'use client'

import * as React from "react"
import { Toaster } from "@/components/ui/sonner"
import { Transaction } from "@/types/Transaction"
import { BrutalDateRangePicker } from "@/components/brutal/BrutalDateRangePicker"
import { BrutalPieChart } from "@/components/brutal/BrutalPieChart"
import { BrutalBarChart } from "@/components/brutal/BrutalBarChart"
import { BrutalLineChart } from "@/components/brutal/BrutalLineChart"
import { BrutalClassificationFilter } from "@/components/brutal/BrutalClassificationFilter"
import { BrutalAddTransactionDialog } from "@/components/brutal/BrutalAddTransactionDialog"
import { BrutalTransactionTable } from "@/components/brutal/BrutalTransactionTable"
import { BrutalHeader } from "@/components/brutal/BrutalHeader"
import { BrutalStatsRow } from "@/components/brutal/BrutalStatsRow"
import { ReauthWarning } from "@/components/ui/ReauthWarning"
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton"
import { AppSignedIn, AppSignedOut, useAppUser } from "@/lib/auth"
import { formatLocalDate } from "@/lib/utils"
import { isAuthTokenUnavailableError, useAuthedFetch } from "@/lib/useAuthedFetch"

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

  React.useEffect(() => {
    if (!isLoaded) return

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

  const filteredData = React.useMemo(() => {
    if (selectedClassifications.size === 0) return data
    return data.filter((tx) => selectedClassifications.has(tx.Classification))
  }, [data, selectedClassifications])

  return (
    <>
      <AppSignedOut>
        <main className="min-h-screen flex items-center justify-center px-4 bg-[#FFFDE6]">
          <div className="text-center space-y-6">
            <div className="brutal-border bg-white p-10 brutal-shadow-lg">
              <h1 className="text-4xl font-black uppercase tracking-tight mb-2">
                MONEY<span className="text-[#FF3366]">.</span>TRACKER
              </h1>
              <p className="text-sm font-mono text-black/60 mb-6">Sign in to track your spending</p>
              <GoogleSignInButton />
            </div>
          </div>
        </main>
      </AppSignedOut>

      <AppSignedIn>
        <ReauthWarning userId={user?.id} userEmail={user?.primaryEmailAddress?.emailAddress ?? undefined} />

        <div className="min-h-screen bg-[#FFFDE6] relative">
          {/* Decorative background elements */}
          <div className="fixed top-20 right-20 w-40 h-40 border-4 border-black rotate-12 opacity-[0.03] pointer-events-none" />
          <div className="fixed bottom-40 left-10 w-60 h-60 bg-[#FF3366] rounded-full opacity-[0.03] pointer-events-none" />
          <div className="fixed top-1/2 left-1/2 w-80 h-80 bg-[#00CCFF] rounded-full opacity-[0.02] pointer-events-none" />

          <BrutalHeader />

          <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <BrutalDateRangePicker onDataFetched={handleDataFetched} />
              <button
                onClick={() => setIsAddDialogOpen(true)}
                className="brutal-border-sm bg-[#00FF88] px-5 py-3 font-black uppercase text-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none brutal-shadow-sm transition-all"
              >
                + ADD TRANSACTION
              </button>
            </div>

            <BrutalAddTransactionDialog
              open={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
              onSuccess={refetch}
            />

            {/* Classification Filter */}
            {data.length > 0 && (
              <BrutalClassificationFilter
                data={data}
                selectedClassifications={selectedClassifications}
                onSelectionChange={setSelectedClassifications}
              />
            )}

            {/* Stats Row */}
            {filteredData.length > 0 && <BrutalStatsRow data={filteredData} />}

            {/* Charts Grid */}
            {filteredData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Bar Chart - Takes more space */}
                <div className="lg:col-span-7">
                  <BrutalBarChart data={filteredData} refetch={refetch} />
                </div>

                {/* Pie Chart */}
                <div className="lg:col-span-5">
                  <BrutalPieChart data={filteredData} refetch={refetch} />
                </div>

                {/* Line Chart - Full width */}
                <div className="lg:col-span-12">
                  <BrutalLineChart data={filteredData} />
                </div>
              </div>
            )}

            {/* Transaction Table */}
            {filteredData.length > 0 && (
              <BrutalTransactionTable data={filteredData} refetch={refetch} />
            )}

            {/* Empty State */}
            {!isInitialLoad && filteredData.length === 0 && (
              <div className="brutal-border bg-white p-12 brutal-shadow text-center">
                <p className="text-2xl font-black uppercase">NO DATA YET</p>
                <p className="text-sm font-mono text-black/50 mt-2">
                  Select a date range or add a transaction to get started
                </p>
              </div>
            )}
          </main>
        </div>

        <Toaster />
      </AppSignedIn>
    </>
  )
}

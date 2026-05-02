'use client'

import * as React from "react"
import { format } from "date-fns"
import { DateRangeForm } from "../components/ui/DateRangeForm"
import { PieChartComponent } from "../components/ui/TransactionPieChart"
// import { BarChartComponent } from "../components/ui/BarChartComponent"
// import { LineChartComponent } from "../components/ui/LineChartComponent"
import { Toaster } from "@/components/ui/sonner"
import { Transaction } from "@/types/Transaction"
import { TransactionTable } from "@/components/ui/TransactionTable"
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
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  CalendarRange,
  Layers3,
  Plus,
  Sparkles,
  Wallet,
  X,
} from "lucide-react"

function normalizeTransactions(payload: unknown): Transaction[] {
  return Array.isArray(payload) ? (payload as Transaction[]) : []
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
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

  const availableClassifications = React.useMemo(() => {
    const unique = new Set<string>()
    data.forEach((tx) => unique.add(tx.Classification))
    return Array.from(unique).sort()
  }, [data])

  const isAllClassificationsSelected = React.useMemo(() => {
    return (
      selectedClassifications.size === 0 ||
      (availableClassifications.length > 0 &&
        selectedClassifications.size === availableClassifications.length)
    )
  }, [availableClassifications, selectedClassifications])

  const singleActiveClassification = React.useMemo(() => {
    if (selectedClassifications.size !== 1) {
      return null
    }

    return Array.from(selectedClassifications)[0] ?? null
  }, [selectedClassifications])

  const topClassification = React.useMemo(() => {
    if (filteredData.length === 0) {
      return null
    }

    const totals = filteredData.reduce<Record<string, number>>((acc, tx) => {
      const amount = Number.parseFloat(tx.Amount.replace(/,/g, "")) || 0
      acc[tx.Classification] = (acc[tx.Classification] ?? 0) + amount
      return acc
    }, {})

    const [classification, amount] =
      Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? []

    return classification ? { classification, amount } : null
  }, [filteredData])

  const totalSpend = React.useMemo(
    () =>
      filteredData.reduce((sum, tx) => {
        return sum + (Number.parseFloat(tx.Amount.replace(/,/g, "")) || 0)
      }, 0),
    [filteredData]
  )

  const rangeLabel = React.useMemo(() => {
    if (!dateRange) {
      return "Current month"
    }

    return `${format(dateRange.from, "MMM d")} to ${format(dateRange.to, "MMM d, yyyy")}`
  }, [dateRange])

  const handleClassificationFocus = React.useCallback((classification: string) => {
    if (selectedClassifications.size === 1 && selectedClassifications.has(classification)) {
      return
    }

    setSelectedClassifications(new Set([classification]))
  }, [selectedClassifications])

  const handleResetClassificationFocus = React.useCallback(() => {
    setSelectedClassifications(new Set(availableClassifications))
  }, [availableClassifications])

  return (
    <>
      <AppSignedOut>
        <main className="relative min-h-screen overflow-hidden">
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex justify-end">
              <ThemeToggle />
            </div>
            <div className="flex flex-1 items-center justify-center py-10">
              <Card className="w-full max-w-3xl border-border/70 bg-card/90 shadow-xl backdrop-blur">
                <CardHeader className="space-y-5 p-8 pb-4 sm:p-10 sm:pb-4">
                  <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
                    Google Pay Cost Analyzer
                  </Badge>
                  <div className="space-y-3">
                    <CardTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Clean spend analysis in the preset’s mist and teal system.
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-base leading-7">
                      Review trends, spot category spikes, and reclassify noisy transactions from one
                      consistent shadcn dashboard.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6 p-8 pt-2 sm:grid-cols-[1.15fr_0.85fr] sm:p-10 sm:pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Wallet className="size-4" />
                        Spend coverage
                      </div>
                      <p className="mt-3 text-2xl font-semibold">Date-range reporting</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Slice transactions by day, week, or month without leaving the main view.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Layers3 className="size-4" />
                        Classification workflow
                      </div>
                      <p className="mt-3 text-2xl font-semibold">Editable categories</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Reclassify or normalize transactions from one shared transaction table.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-background/70 p-6 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="size-4" />
                        Secure entry
                      </div>
                      <h2 className="text-xl font-semibold">Sign in to continue</h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Google sign-in unlocks Gmail-backed ingestion and keeps the dashboard scoped to
                        your own spend history.
                      </p>
                    </div>
                    <div className="mt-6">
                      <GoogleSignInButton />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </AppSignedOut>

      <AppSignedIn>
        <ReauthWarning
          userId={user?.id}
          userEmail={user?.primaryEmailAddress?.emailAddress ?? undefined}
        />

        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
          <header className="rounded-[1.75rem] border border-border/70 bg-background/75 p-5 shadow-sm backdrop-blur sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
                    Live spend dashboard
                  </Badge>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Google Pay spend, clarified.
                  </h1>
                </div>
                <div className="flex items-center gap-3 self-start">
                  <div className="hidden rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground shadow-sm sm:flex">
                    {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
                  </div>
                  <ThemeToggle />
                </div>
              </div>

              <DateRangeForm
                onDataFetched={handleDataFetched}
                actions={
                  <>
                    {data.length > 0 ? (
                      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                        <ClassificationFilter
                          data={data}
                          selectedClassifications={selectedClassifications}
                          onSelectionChange={setSelectedClassifications}
                        />
                        {!isAllClassificationsSelected ? (
                          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-2 text-sm text-muted-foreground shadow-sm">
                            <span className="truncate">
                              {singleActiveClassification
                                ? `Focused: ${singleActiveClassification}`
                                : `Filtered: ${selectedClassifications.size} classifications`}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-full px-2"
                              onClick={handleResetClassificationFocus}
                            >
                              <X className="size-3.5" />
                              Show all
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <Button
                      onClick={() => setIsAddDialogOpen(true)}
                      className="h-11 w-full gap-2 rounded-xl sm:w-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Add Transaction
                    </Button>
                  </>
                }
              />
            </div>
          </header>

          <section className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            <Card className="min-w-[15rem] shrink-0 rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm md:min-w-0">
              <CardHeader className="gap-2 p-4 pb-2 md:pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="size-4" />
                  Total Spend
                </CardDescription>
                <CardTitle className="text-2xl md:text-3xl">{formatCurrency(totalSpend)}</CardTitle>
              </CardHeader>
              <CardContent className="hidden pt-0 text-sm text-muted-foreground md:block">
                Filtered across {filteredData.length} transaction{filteredData.length === 1 ? "" : "s"}.
              </CardContent>
            </Card>
            <Card className="min-w-[15rem] shrink-0 rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm md:min-w-0">
              <CardHeader className="gap-2 p-4 pb-2 md:pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Layers3 className="size-4" />
                  Top Classification
                </CardDescription>
                <CardTitle className="text-xl md:text-2xl">
                  {topClassification?.classification ?? "No data"}
                </CardTitle>
              </CardHeader>
              <CardContent className="hidden pt-0 text-sm text-muted-foreground md:block">
                {topClassification ? formatCurrency(topClassification.amount) : "Select a range to populate this card."}
              </CardContent>
            </Card>
            <Card className="min-w-[15rem] shrink-0 rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm md:min-w-0">
              <CardHeader className="gap-2 p-4 pb-2 md:pb-3">
                <CardDescription className="flex items-center gap-2">
                  <CalendarRange className="size-4" />
                  Active Range
                </CardDescription>
                <CardTitle className="text-xl md:text-2xl">{rangeLabel}</CardTitle>
              </CardHeader>
              <CardContent className="hidden pt-0 text-sm text-muted-foreground md:block">
                {selectedClassifications.size > 0
                  ? `${selectedClassifications.size} classifications currently visible.`
                  : "All classifications currently visible."}
              </CardContent>
            </Card>
          </section>

          <AddTransactionDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            onSuccess={refetch}
          />

          {data.length === 0 ? (
            <Card className="border-dashed border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <CardTitle>No transactions for this view</CardTitle>
                <CardDescription>
                  Try another date range, adjust classification filters, or add a transaction manually.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <PieChartComponent
                  data={filteredData}
                  activeClassification={singleActiveClassification}
                  onClassificationSelect={handleClassificationFocus}
                />

                <div className="flex flex-col gap-6">
                  <VerticalBarChart
                    data={filteredData}
                    activeClassification={singleActiveClassification}
                    onClassificationSelect={handleClassificationFocus}
                  />
                  <GlowingLineChart data={filteredData} />
                </div>
              </div>

              <TransactionTable
                data={filteredData}
                refetch={refetch}
                rangeLabel={rangeLabel}
                activeClassification={singleActiveClassification}
                hasActiveClassificationFilter={!isAllClassificationsSelected}
                onResetFilters={handleResetClassificationFocus}
              />
            </>
          )}

          <div className="pb-2">
            <Toaster />
          </div>
        </main>
      </AppSignedIn>
    </>
  )
}

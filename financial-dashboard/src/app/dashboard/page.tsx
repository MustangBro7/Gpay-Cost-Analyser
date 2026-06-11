'use client'

import * as React from "react"
import { differenceInCalendarDays, format, subDays } from "date-fns"
import Image from "next/image"
import Link from "next/link"
import { DateRangeForm } from "@/components/ui/DateRangeForm"
import { PieChartComponent } from "@/components/ui/TransactionPieChart"
import { Toaster } from "@/components/ui/sonner"
import { Transaction } from "@/types/Transaction"
import { TransactionTable } from "@/components/ui/TransactionTable"
import { GlowingLineChart } from "@/components/ui/glowing-line"
import { VerticalBarChart } from "@/components/ui/VerticalBarChart"
import { ClassificationFilter } from "@/components/ui/ClassificationFilter"
import { AddTransactionDialog } from "@/components/ui/AddTransactionDialog"
import { ClassificationSettingsDialog } from "@/components/ui/ClassificationSettingsDialog"
import { ReauthWarning } from "@/components/ui/ReauthWarning"
import { TopReceivers } from "@/components/ui/TopReceivers"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton"
import {
  getDefaultClassificationSettings,
  normalizeClassificationSettings,
} from "@/lib/classificationSettings"
import { AppSignedIn, AppSignedOut, useAppUser } from "@/lib/auth"
import { formatLocalDate } from "@/lib/utils"
import { getTransactionDateKey, formatTransactionDateKey } from "@/lib/transactionDate"
import { isAuthTokenUnavailableError, useAuthedFetch } from "@/lib/useAuthedFetch"
import { UpdateClassificationSettingsRequest } from "@/types/ClassificationSettings"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatCard, TrendChip, type StatTrend } from "@/components/ui/StatCard"
import { ThemeToggle } from "@/components/theme-toggle"
import { ClassificationSettings } from "@/types/ClassificationSettings"
import {
  ArrowLeft,
  CalendarClock,
  Plus,
  Receipt,
  SearchX,
  SlidersHorizontal,
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

function sumAmounts(transactions: Transaction[]) {
  return transactions.reduce(
    (sum, tx) => sum + (Number.parseFloat(tx.Amount.replace(/,/g, "")) || 0),
    0
  )
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null
  }
  return ((current - previous) / previous) * 100
}

export default function DashboardPage() {
  const [data, setData] = React.useState<Transaction[]>([])
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date } | null>(null)
  const [previousPeriod, setPreviousPeriod] = React.useState<{ total: number; count: number } | null>(null)
  const [selectedClassifications, setSelectedClassifications] = React.useState<Set<string>>(new Set())
  const [isInitialLoad, setIsInitialLoad] = React.useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isClassificationSettingsOpen, setIsClassificationSettingsOpen] = React.useState(false)
  const [classificationSettings, setClassificationSettings] = React.useState<ClassificationSettings>(
    getDefaultClassificationSettings()
  )
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

  const fetchClassificationSettings = React.useCallback(async () => {
    if (!website_url) {
      setClassificationSettings(getDefaultClassificationSettings())
      return
    }

    let response: Response
    try {
      response = await authedFetch(`${website_url}/classification-settings`)
    } catch (error) {
      if (isAuthTokenUnavailableError(error)) {
        return
      }

      console.error("Failed to fetch classification settings:", error)
      return
    }

    if (!response.ok) {
      if (response.status === 401) {
        return
      }

      console.error(`Failed to fetch classification settings: ${response.status}`)
      return
    }

    const payload = await response.json()
    setClassificationSettings(normalizeClassificationSettings(payload))
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
      fetchClassificationSettings().catch((error) => {
        console.error("Failed to load classification settings:", error)
      })
      return
    }

    if (isInitialLoad && !user) {
      setData([])
      setIsInitialLoad(false)
      setClassificationSettings(getDefaultClassificationSettings())
    }
  }, [isInitialLoad, fetchClassificationSettings, fetchData, isLoaded, user])

  React.useEffect(() => {
    if (!isLoaded || !user) {
      return
    }

    fetchClassificationSettings().catch((error) => {
      console.error("Failed to refresh classification settings:", error)
    })
  }, [fetchClassificationSettings, isLoaded, user])

  // Fetch the equally-sized period immediately before the active range so the
  // stat cards can show period-over-period trends.
  React.useEffect(() => {
    if (!dateRange || !user || !website_url) {
      setPreviousPeriod(null)
      return
    }

    const days = Math.max(1, differenceInCalendarDays(dateRange.to, dateRange.from) + 1)
    const prevTo = subDays(dateRange.from, 1)
    const prevFrom = subDays(prevTo, days - 1)

    let cancelled = false
    ;(async () => {
      try {
        const response = await authedFetch(`${website_url}/daterange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: formatLocalDate(prevFrom),
            endDate: formatLocalDate(prevTo),
          }),
        })
        if (!response.ok) {
          if (!cancelled) setPreviousPeriod(null)
          return
        }
        const payload = normalizeTransactions(await response.json())
        if (!cancelled) {
          setPreviousPeriod({ total: sumAmounts(payload), count: payload.length })
        }
      } catch {
        if (!cancelled) setPreviousPeriod(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authedFetch, dateRange, user, website_url])

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

  const totalSpend = React.useMemo(() => sumAmounts(filteredData), [filteredData])
  const unfilteredTotal = React.useMemo(() => sumAmounts(data), [data])

  const rangeDays = React.useMemo(() => {
    if (!dateRange) {
      return null
    }
    return Math.max(1, differenceInCalendarDays(dateRange.to, dateRange.from) + 1)
  }, [dateRange])

  const dailyAverage = React.useMemo(() => {
    if (!rangeDays || totalSpend === 0) {
      return 0
    }
    return totalSpend / rangeDays
  }, [rangeDays, totalSpend])

  const busiestDay = React.useMemo(() => {
    if (filteredData.length === 0) {
      return null
    }

    const totals = new Map<string, number>()
    filteredData.forEach((tx) => {
      const key = getTransactionDateKey(tx.Date)
      const amount = Number.parseFloat(tx.Amount.replace(/,/g, "")) || 0
      totals.set(key, (totals.get(key) ?? 0) + amount)
    })

    const [date, amount] =
      Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0] ?? []

    return date ? { label: formatTransactionDateKey(date), amount } : null
  }, [filteredData])

  const spendTrend = React.useMemo<StatTrend | undefined>(() => {
    if (!previousPeriod) {
      return undefined
    }
    const percent = percentChange(unfilteredTotal, previousPeriod.total)
    if (percent == null) {
      return undefined
    }
    return {
      percent,
      label: "vs previous period",
      sentiment: percent > 0 ? "negative" : "positive",
    }
  }, [previousPeriod, unfilteredTotal])

  const countTrend = React.useMemo<StatTrend | undefined>(() => {
    if (!previousPeriod) {
      return undefined
    }
    const percent = percentChange(data.length, previousPeriod.count)
    if (percent == null) {
      return undefined
    }
    return { percent, label: "vs previous", sentiment: "neutral" }
  }, [data.length, previousPeriod])

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

  const handleClassificationSettingsSave = React.useCallback(async (payload: UpdateClassificationSettingsRequest) => {
    if (!website_url) {
      return
    }

    const response = await authedFetch(`${website_url}/classification-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categories: payload.categories,
        rulesText: payload.rulesText,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || "Failed to save classification settings")
    }

    const nextSettings = await response.json()
    setClassificationSettings(normalizeClassificationSettings(nextSettings))
  }, [authedFetch, website_url])

  const userEmail = user?.primaryEmailAddress?.emailAddress

  return (
    <>
      <AppSignedOut>
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <Card className="relative w-full max-w-md rounded-[1.75rem] border-border/70 bg-card/90 text-center shadow-xl backdrop-blur">
            <CardHeader className="items-center gap-4">
              <Image
                src="/app-logo.png"
                alt="GPay Cost Analyzer logo"
                width={56}
                height={56}
                className="mx-auto rounded-full shadow-sm ring-1 ring-border/70"
              />
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Sign in to view your dashboard
                </CardTitle>
                <CardDescription className="leading-6">
                  Your spending data is private — sign in with the Google account that receives
                  your Google Pay receipts.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <GoogleSignInButton redirectUrlComplete="/dashboard" />
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/">
                  <ArrowLeft className="size-4" />
                  Back to home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </AppSignedOut>

      <AppSignedIn>
        <ReauthWarning userId={user?.id} userEmail={userEmail ?? undefined} />

        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-2.5">
              <Image
                src="/app-logo.png"
                alt="GPay Cost Analyzer logo"
                width={36}
                height={36}
                className="rounded-full shadow-sm ring-1 ring-border/70"
              />
              <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
                GPay Cost Analyzer
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full px-3 sm:px-4"
                onClick={() => setIsClassificationSettingsOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Classification rules</span>
              </Button>
              {userEmail ? (
                <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/80 py-1 pl-1 pr-3 text-sm text-muted-foreground shadow-sm lg:flex">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold uppercase text-primary">
                    {userEmail[0]}
                  </span>
                  <span className="max-w-[14rem] truncate">{userEmail}</span>
                </div>
              ) : null}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Spending overview
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rangeLabel} · {filteredData.length} transaction{filteredData.length === 1 ? "" : "s"} in view
                </p>
              </div>
            </div>

            <DateRangeForm
              onDataFetched={handleDataFetched}
              showInlinePresets
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
          </section>

          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Card className="relative col-span-2 min-w-0 gap-3 overflow-hidden rounded-[1.75rem] border-transparent bg-primary py-5 text-primary-foreground shadow-lg">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary-foreground/10 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-10 size-48 rounded-full bg-primary-foreground/10 blur-2xl"
              />
              <CardHeader className="relative gap-2.5">
                <CardDescription className="flex items-center gap-2.5 text-primary-foreground/80">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                    <Wallet className="size-4" />
                  </span>
                  Total Spend
                </CardDescription>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {formatCurrency(totalSpend)}
                  </CardTitle>
                  {spendTrend ? (
                    <TrendChip
                      trend={spendTrend}
                      className="border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground"
                    />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="relative pt-0 text-sm text-primary-foreground/80">
                {rangeLabel} · {filteredData.length} transaction{filteredData.length === 1 ? "" : "s"}
                {topClassification
                  ? ` · most spent on ${topClassification.classification}`
                  : ""}
              </CardContent>
            </Card>
            <StatCard
              icon={Receipt}
              label="Transactions"
              value={filteredData.length}
              trend={countTrend}
              hint={
                filteredData.length > 0
                  ? `Averaging ${formatCurrency(totalSpend / filteredData.length)} per transaction.`
                  : "No transactions in the current view."
              }
              className="min-w-0"
            />
            <StatCard
              icon={CalendarClock}
              label="Daily Average"
              value={formatCurrency(dailyAverage)}
              hint={
                busiestDay
                  ? `Busiest day: ${busiestDay.label} (${formatCurrency(busiestDay.amount)}).`
                  : `Across ${rangeDays ?? 0} day${rangeDays === 1 ? "" : "s"} in range.`
              }
              className="min-w-0"
            />
          </section>

          <AddTransactionDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            onSuccess={refetch}
            classificationCategories={classificationSettings.categories}
          />

          <ClassificationSettingsDialog
            open={isClassificationSettingsOpen}
            onOpenChange={setIsClassificationSettingsOpen}
            settings={classificationSettings}
            onSave={handleClassificationSettingsSave}
          />

          {data.length === 0 ? (
            <Card className="rounded-[1.75rem] border-dashed border-border/70 bg-card/85 shadow-sm">
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <SearchX className="size-6" />
                </span>
                <div className="space-y-1.5">
                  <CardTitle className="text-xl font-semibold tracking-tight">
                    No transactions for this view
                  </CardTitle>
                  <CardDescription className="mx-auto max-w-md leading-6">
                    Try another date range, adjust classification filters, or add a transaction
                    manually.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  variant="outline"
                  className="h-10 rounded-full px-4"
                >
                  <Plus className="size-4" />
                  Add a transaction
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-8">
                  <GlowingLineChart data={filteredData} />
                </div>
                <div className="min-w-0 xl:col-span-4">
                  <PieChartComponent
                    data={filteredData}
                    activeClassification={singleActiveClassification}
                    onClassificationSelect={handleClassificationFocus}
                  />
                </div>
                <div className="min-w-0 xl:col-span-7">
                  <VerticalBarChart
                    data={filteredData}
                    activeClassification={singleActiveClassification}
                    onClassificationSelect={handleClassificationFocus}
                  />
                </div>
                <div className="min-w-0 xl:col-span-5">
                  <TopReceivers data={filteredData} />
                </div>
              </div>

              <TransactionTable
                data={filteredData}
                refetch={refetch}
                rangeLabel={rangeLabel}
                classificationCategories={classificationSettings.categories}
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

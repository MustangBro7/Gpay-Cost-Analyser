
'use client'

import * as React from "react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns"
import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Transaction } from "@/types/Transaction"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useAppAuth } from "@/lib/auth"
import { formatLocalDate } from "@/lib/utils"
import { isAuthTokenUnavailableError, useAuthedFetch } from "@/lib/useAuthedFetch"
import { CalendarRange, Loader2 } from "lucide-react"

// Helper function to get start and end of current month
const getCurrentMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: start, to: end }
}

// Preset date range helpers
const getPresets = () => {
  const now = new Date()
  return [
    {
      label: "Today",
      range: { from: now, to: now },
    },
    {
      label: "This Week",
      range: {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      },
    },
    {
      label: "Last Week",
      range: {
        from: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
        to: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
      },
    },
    {
      label: "This Month",
      range: {
        from: startOfMonth(now),
        to: endOfMonth(now),
      },
    },
    {
      label: "Last Month",
      range: {
        from: startOfMonth(subMonths(now, 1)),
        to: endOfMonth(subMonths(now, 1)),
      },
    },
  ]
}

// 👇 Accept a callback prop and optional actions
export function DateRangeForm({
  onDataFetched,
  actions,
}: {
  onDataFetched: (data: Transaction[], range: { from: Date; to: Date }) => void
  actions?: React.ReactNode
}){
  const currentMonth = getCurrentMonthRange()
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: currentMonth.from,
    to: currentMonth.to,
  })
  const [isLoading, setIsLoading] = React.useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const isFirstRender = React.useRef(true)
  const inFlightRef = React.useRef(false)
  const authedFetch = useAuthedFetch()
  const { isLoaded, isSignedIn } = useAppAuth()
  const fromTime = date?.from?.getTime()
  const toTime = date?.to?.getTime()

  // Fetch data whenever date range changes (after both from and to are selected)
  React.useEffect(() => {
    // Skip the initial render since page.tsx already fetches data on mount
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const fromDate = date?.from
    const toDate = date?.to
    
    if (!isLoaded || !isSignedIn || !fromDate || !toDate || inFlightRef.current) return

    const fetchData = async () => {
      inFlightRef.current = true
      setIsLoading(true)
      try {
        const website_url = process.env.NEXT_PUBLIC_API_URL
        if (!website_url) {
          return
        }
        const response = await authedFetch(`${website_url}/daterange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: formatLocalDate(fromDate),
            endDate: formatLocalDate(toDate),
          })
        }).catch((error) => {
          if (isAuthTokenUnavailableError(error)) {
            onDataFetched([], { from: fromDate, to: toDate })
            return null
          }
          throw error
        })

        if (!response) {
          return
        }

        if (!response.ok) {
          if (response.status === 401) {
            onDataFetched([], { from: fromDate, to: toDate })
            return
          }
          throw new Error(`Failed to fetch transactions: ${response.status}`)
        }
      
        const payload = await response.json()
        onDataFetched(Array.isArray(payload) ? payload : [], { from: fromDate, to: toDate })
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        inFlightRef.current = false
        setIsLoading(false)
      }
    }

    fetchData()
  }, [authedFetch, date?.from, date?.to, fromTime, toTime, isLoaded, isSignedIn, onDataFetched])

  const handlePresetSelect = (range: DateRange) => {
    setDate(range)
    setIsPopoverOpen(false)
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-11 w-full justify-start gap-2 rounded-xl border-border/70 bg-background/75 px-4 text-left font-normal shadow-sm sm:w-[320px]"
            disabled={isLoading}
          >
            <CalendarRange className="size-4 text-muted-foreground" />
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : date?.from ? (
              date.to
                ? `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
                : format(date.from, "LLL dd, y")
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="mx-4 w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-2xl border-border/70 bg-popover/95 p-0 shadow-2xl backdrop-blur" 
          align="center"
          sideOffset={8}
        >
          <div className="flex flex-col items-center">
            <div className="flex w-full flex-wrap justify-center gap-1.5 border-b border-border/70 p-3">
              {getPresets().map((preset) => (
                <Button
                  key={preset.label}
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => handlePresetSelect(preset.range)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex justify-center p-2">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={1}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {actions ? <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{actions}</div> : null}
    </div>
  )
}

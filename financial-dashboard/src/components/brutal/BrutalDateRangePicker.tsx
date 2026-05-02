'use client'

import * as React from "react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns"
import { DateRange } from "react-day-picker"
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

const getCurrentMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: start, to: end }
}

const getPresets = () => {
  const now = new Date()
  return [
    { label: "TODAY", range: { from: now, to: now } },
    { label: "THIS WEEK", range: { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) } },
    { label: "LAST WEEK", range: { from: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), to: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) } },
    { label: "THIS MONTH", range: { from: startOfMonth(now), to: endOfMonth(now) } },
    { label: "LAST MONTH", range: { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) } },
  ]
}

export function BrutalDateRangePicker({
  onDataFetched,
}: {
  onDataFetched: (data: Transaction[], range: { from: Date; to: Date }) => void
}) {
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

  React.useEffect(() => {
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
        if (!website_url) return

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

        if (!response) return

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
  }, [authedFetch, date?.from?.getTime(), date?.to?.getTime(), isLoaded, isSignedIn, onDataFetched])

  const handlePresetSelect = (range: DateRange) => {
    setDate(range)
    setIsPopoverOpen(false)
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className="brutal-border-sm bg-white px-5 py-3 font-mono font-bold text-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none brutal-shadow-sm transition-all flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="animate-pulse">LOADING...</span>
          ) : date?.from ? (
            date.to
              ? `${format(date.from, "dd MMM")} → ${format(date.to, "dd MMM yyyy")}`
              : format(date.from, "dd MMM yyyy")
          ) : (
            "PICK DATE RANGE"
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-[340px] p-0 brutal-border-sm brutal-shadow-sm bg-white"
        align="start"
        sideOffset={8}
      >
        <div className="flex flex-col">
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 border-b-3 border-black p-3 bg-[#FFEE00]">
            {getPresets().map((preset) => (
              <button
                key={preset.label}
                className="text-[10px] font-black uppercase px-2.5 py-1.5 border-2 border-black bg-white hover:bg-[#00FF88] transition-colors"
                onClick={() => handlePresetSelect(preset.range)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {/* Calendar */}
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
  )
}


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
import { formatLocalDate } from "@/lib/utils"
import { Loader2 } from "lucide-react"

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

  // Fetch data whenever date range changes (after both from and to are selected)
  React.useEffect(() => {
    // Skip the initial render since page.tsx already fetches data on mount
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (!date?.from || !date?.to || isLoading) return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const website_url = process.env.NEXT_PUBLIC_API_URL
        const response = await fetch(`${website_url}/daterange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: formatLocalDate(date.from),
            endDate: formatLocalDate(date.to),
          })
        })
      
        const data = await response.json()
        onDataFetched(data, { from: date.from, to: date.to })
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [date?.from?.getTime(), date?.to?.getTime()])

  const handlePresetSelect = (range: DateRange) => {
    setDate(range)
    setIsPopoverOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[300px] justify-start text-left font-normal"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            {/* Presets sidebar */}
            <div className="flex flex-row sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r p-3 min-w-[120px] overflow-x-auto">
              <p className="hidden sm:block text-xs font-medium text-muted-foreground mb-2">Quick Select</p>
              {getPresets().map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-sm font-normal whitespace-nowrap"
                  onClick={() => handlePresetSelect(preset.range)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar */}
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>

      {actions}
    </div>
  )
}
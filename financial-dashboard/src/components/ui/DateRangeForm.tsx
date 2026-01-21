
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

    const fromDate = date?.from
    const toDate = date?.to
    
    if (!fromDate || !toDate || isLoading) return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const website_url = process.env.NEXT_PUBLIC_API_URL
        const response = await fetch(`${website_url}/daterange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: formatLocalDate(fromDate),
            endDate: formatLocalDate(toDate),
          })
        })
      
        const data = await response.json()
        onDataFetched(data, { from: fromDate, to: toDate })
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
    <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 w-full px-4 sm:px-0">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full sm:w-[300px] justify-center sm:justify-start text-left font-normal"
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
        <PopoverContent 
          className="w-[calc(100vw-2rem)] max-w-[320px] p-0 mx-4" 
          align="center"
          sideOffset={8}
        >
          <div className="flex flex-col items-center">
            {/* Presets - wrap on multiple lines */}
            <div className="flex flex-wrap justify-center gap-1.5 border-b p-3 w-full">
              {getPresets().map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="text-xs font-medium px-3 h-8"
                  onClick={() => handlePresetSelect(preset.range)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar - centered */}
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

      {actions}
    </div>
  )
}
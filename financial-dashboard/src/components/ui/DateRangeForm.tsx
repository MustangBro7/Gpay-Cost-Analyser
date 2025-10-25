
'use client'

import * as React from "react"
import { format } from "date-fns"
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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: startOfMonth, to: endOfMonth }
}

// 👇 Accept a callback prop
export function DateRangeForm({
  onDataFetched,
}: {
  onDataFetched: (data: Transaction[], range: { from: Date; to: Date }) => void
}){
  const currentMonth = getCurrentMonthRange()
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: currentMonth.from,
    to: currentMonth.to,
  })
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async () => {
    if (!date?.from || !date?.to || isLoading) return
    
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

  return (
    <div className="flex flex-col items-start space-y-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[300px] justify-start text-left font-normal"
            disabled={isLoading}
          >
            {date?.from
              ? date.to
                ? `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
                : format(date.from, "LLL dd, y")
              : <span>Pick a date range</span>
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          'Submit'
        )}
      </Button>
    </div>
  )
}
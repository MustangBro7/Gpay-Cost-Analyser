
'use client'

import * as React from "react"
import { addDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Transaction } from "@/types/Transaction"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// 👇 Accept a callback prop
export function DateRangeForm({
  onDataFetched,
}: {
  onDataFetched: (data: Transaction[], range: { from: Date; to: Date }) => void
}){
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  })

  // const handleSubmit = async () => {
  //   if (!date?.from || !date?.to) return

  //   const response = await fetch('http://127.0.0.1:8000/daterange', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       startDate: date.from.toISOString().split('T')[0],
  //       endDate: date.to.toISOString().split('T')[0],
  //     })
  //   })

  //   const data = await response.json()
  //   onDataFetched(data, {from: date.from, to: date.to}) // Pass range too
  // }
  const handleSubmit = async () => {
    if (!date?.from || !date?.to) return
  const website_url = process.env.NEXT_PUBLIC_API_URL
    const response = await fetch(`${website_url}/daterange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: format(date.from, "yyyy-MM-dd"),
        endDate: format(date.to, "yyyy-MM-dd"),
      })
    })
  
    const data = await response.json()
    onDataFetched(data, { from: date.from, to: date.to })
  }

  return (
    <div className="flex flex-col items-start space-y-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[300px] justify-start text-left font-normal"
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

      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  )
}
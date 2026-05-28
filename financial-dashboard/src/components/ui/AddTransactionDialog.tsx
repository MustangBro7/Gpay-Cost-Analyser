"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ClassificationInput } from "@/components/ui/ClassificationInput"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { format } from "date-fns"

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  classificationCategories: string[]
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  onSuccess,
  classificationCategories,
}: AddTransactionDialogProps) {
  const [amount, setAmount] = React.useState("")
  const [receiver, setReceiver] = React.useState("")
  const [classificationInput, setClassificationInput] = React.useState("")
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
  const [time, setTime] = React.useState(
    format(new Date(), "HH:mm")
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const website_url = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setAmount("")
      setReceiver("")
      setClassificationInput("")
      setDate(new Date())
      setTime(format(new Date(), "HH:mm"))
    }
  }, [open])

  const handleSubmit = async () => {
    const finalClassification = classificationInput.trim()

    // Validation
    if (!amount || isNaN(parseFloat(amount))) {
      toast.error("Please enter a valid amount")
      return
    }
    if (!receiver.trim()) {
      toast.error("Please enter a receiver name")
      return
    }
    if (!finalClassification) {
      toast.error("Please enter or select a classification")
      return
    }
    if (!date) {
      toast.error("Please select a date")
      return
    }

    setIsSubmitting(true)
    try {
      // Combine date and time into a single datetime string
      const [hours, minutes] = time.split(":").map(Number)
      const dateTime = new Date(date)
      dateTime.setHours(hours, minutes, 0, 0)
      const formattedDate = format(dateTime, "yyyy-MM-dd HH:mm:ss")

      const response = await authedFetch(`${website_url}/add-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Amount: amount.replace(/,/g, ""),
          Classification: finalClassification,
          Receiver: receiver.trim(),
          Date: formattedDate,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || "Failed to add transaction")
      }

      toast.success("Transaction added!", {
        description: `₹${amount} to ${receiver}`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error("Add transaction error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to add transaction")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto rounded-xl p-5 sm:p-6">
        <DialogHeader className="text-center sm:text-left pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-semibold">Add Transaction</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1">
            Manually add a new transaction to your records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-5">
          {/* Amount */}
          <div className="space-y-2.5">
            <label className="text-sm font-medium block">Amount (₹)</label>
            <Input
              type="text"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 text-base px-4"
            />
          </div>

          {/* Receiver */}
          <div className="space-y-2.5">
            <label className="text-sm font-medium block">Receiver / Merchant</label>
            <Input
              type="text"
              placeholder="e.g., Zomato, Amazon, John Doe"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              className="h-12 text-base px-4"
            />
          </div>

          {/* Classification - Combobox */}
          <div className="space-y-2.5">
            <label className="text-sm font-medium block">Classification</label>
            <div className="relative">
              <ClassificationInput
                categories={classificationCategories}
                value={classificationInput}
                onChange={setClassificationInput}
              />
            </div>
          </div>

          {/* Date & Time - Visual separator */}
          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <label className="text-sm font-medium block">Date</label>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 justify-start text-left font-normal text-base px-4",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-3 h-5 w-5" />
                      {date ? format(date, "PP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-0" 
                    align="center"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                  >
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(newDate) => {
                        setDate(newDate)
                        setIsDatePickerOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-medium block">Time</label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-12 text-base px-4"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 text-base"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 text-base font-medium"
          >
            {isSubmitting ? "Adding..." : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

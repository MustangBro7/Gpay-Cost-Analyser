"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const CLASSIFICATIONS = [
  "Quick Commerce",
  "Ecommerce",
  "Subscriptions",
  "Public Transport",
  "Office Lunch",
  "Grocery",
  "Eating Out",
  "Personal Transfer",
  "Fuel",
  "Personal Contact",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Utilities",
  "Other",
]

export function AddTransactionDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddTransactionDialogProps) {
  const [amount, setAmount] = React.useState("")
  const [receiver, setReceiver] = React.useState("")
  const [classification, setClassification] = React.useState("")
  const [classificationInput, setClassificationInput] = React.useState("")
  const [isClassificationOpen, setIsClassificationOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
  const [time, setTime] = React.useState(
    format(new Date(), "HH:mm")
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const classificationInputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const website_url = process.env.NEXT_PUBLIC_API_URL

  // Filter classifications based on input
  const filteredClassifications = React.useMemo(() => {
    if (!classificationInput.trim()) return CLASSIFICATIONS
    const search = classificationInput.toLowerCase()
    return CLASSIFICATIONS.filter((cat) =>
      cat.toLowerCase().includes(search)
    )
  }, [classificationInput])

  // Check if the current input is a custom value (not in the list)
  const isCustomValue = React.useMemo(() => {
    if (!classificationInput.trim()) return false
    return !CLASSIFICATIONS.some(
      (cat) => cat.toLowerCase() === classificationInput.toLowerCase()
    )
  }, [classificationInput])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        classificationInputRef.current &&
        !classificationInputRef.current.contains(event.target as Node)
      ) {
        setIsClassificationOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setAmount("")
      setReceiver("")
      setClassification("")
      setClassificationInput("")
      setIsClassificationOpen(false)
      setDate(new Date())
      setTime(format(new Date(), "HH:mm"))
    }
  }, [open])

  const selectClassification = (value: string) => {
    setClassification(value)
    setClassificationInput(value)
    setIsClassificationOpen(false)
  }

  const handleSubmit = async () => {
    // Use the input value (allows custom classifications)
    const finalClassification = classificationInput.trim() || classification

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

      const response = await fetch(`${website_url}/add-transaction`, {
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
              <div className="relative">
                <Input
                  ref={classificationInputRef}
                  type="text"
                  placeholder="Type or select a category..."
                  value={classificationInput}
                  onChange={(e) => {
                    setClassificationInput(e.target.value)
                    setClassification("")
                    setIsClassificationOpen(true)
                  }}
                  onFocus={() => setIsClassificationOpen(true)}
                  className="h-12 text-base px-4 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setIsClassificationOpen(!isClassificationOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <ChevronsUpDown className="h-5 w-5" />
                </button>
              </div>

              {isClassificationOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 mt-2 w-full rounded-lg border bg-popover p-1.5 shadow-lg max-h-52 overflow-y-auto"
                >
                  {/* Show custom value option if input doesn't match any existing */}
                  {isCustomValue && classificationInput.trim() && (
                    <button
                      type="button"
                      onClick={() => selectClassification(classificationInput.trim())}
                      className="relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="mr-2 text-muted-foreground">+</span>
                      Create &quot;{classificationInput.trim()}&quot;
                    </button>
                  )}

                  {filteredClassifications.length > 0 ? (
                    filteredClassifications.map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => selectClassification(cat)}
                        className={cn(
                          "relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                          classification === cat && "bg-accent"
                        )}
                      >
                        <Check
                          className={cn(
                            "mr-2.5 h-4 w-4",
                            classification === cat ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {cat}
                      </button>
                    ))
                  ) : (
                    !isCustomValue && (
                      <div className="px-3 py-2.5 text-sm text-muted-foreground text-center">
                        No categories found
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
            {classificationInput && !classification && isCustomValue && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Press Enter or click to add a custom category
              </p>
            )}
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

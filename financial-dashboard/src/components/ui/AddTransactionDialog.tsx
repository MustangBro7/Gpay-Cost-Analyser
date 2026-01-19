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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Manually add a new transaction to your records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (₹)</label>
            <Input
              type="text"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Receiver */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Receiver / Merchant</label>
            <Input
              type="text"
              placeholder="e.g., Zomato, Amazon, John Doe"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
            />
          </div>

          {/* Classification - Combobox */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Classification</label>
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
                  className="pr-8"
                />
                <button
                  type="button"
                  onClick={() => setIsClassificationOpen(!isClassificationOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronsUpDown className="h-4 w-4" />
                </button>
              </div>

              {isClassificationOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md max-h-60 overflow-y-auto"
                >
                  {/* Show custom value option if input doesn't match any existing */}
                  {isCustomValue && classificationInput.trim() && (
                    <button
                      type="button"
                      onClick={() => selectClassification(classificationInput.trim())}
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
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
                          "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                          classification === cat && "bg-accent"
                        )}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            classification === cat ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {cat}
                      </button>
                    ))
                  ) : (
                    !isCustomValue && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No categories found
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
            {classificationInput && !classification && isCustomValue && (
              <p className="text-xs text-muted-foreground">
                Press Enter or click to add a custom category
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

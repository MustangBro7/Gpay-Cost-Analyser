'use client'

import * as React from "react"
import { toast } from "sonner"
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
import { cn } from "@/lib/utils"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { format } from "date-fns"

interface BrutalAddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const CLASSIFICATIONS = [
  "Quick Commerce", "Ecommerce", "Subscriptions", "Public Transport",
  "Office Lunch", "Grocery", "Eating Out", "Personal Transfer",
  "Fuel", "Personal Contact", "Entertainment", "Healthcare",
  "Shopping", "Utilities", "Other",
]

export function BrutalAddTransactionDialog({
  open,
  onOpenChange,
  onSuccess,
}: BrutalAddTransactionDialogProps) {
  const [amount, setAmount] = React.useState("")
  const [receiver, setReceiver] = React.useState("")
  const [classification, setClassification] = React.useState("")
  const [classificationInput, setClassificationInput] = React.useState("")
  const [isClassificationOpen, setIsClassificationOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
  const [time, setTime] = React.useState(format(new Date(), "HH:mm"))
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const classificationInputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const website_url = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  const filteredClassifications = React.useMemo(() => {
    if (!classificationInput.trim()) return CLASSIFICATIONS
    const search = classificationInput.toLowerCase()
    return CLASSIFICATIONS.filter((cat) => cat.toLowerCase().includes(search))
  }, [classificationInput])

  const isCustomValue = React.useMemo(() => {
    if (!classificationInput.trim()) return false
    return !CLASSIFICATIONS.some((cat) => cat.toLowerCase() === classificationInput.toLowerCase())
  }, [classificationInput])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        classificationInputRef.current && !classificationInputRef.current.contains(event.target as Node)
      ) {
        setIsClassificationOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
    const finalClassification = classificationInput.trim() || classification

    if (!amount || isNaN(parseFloat(amount))) {
      toast.error("Enter a valid amount")
      return
    }
    if (!receiver.trim()) {
      toast.error("Enter a receiver name")
      return
    }
    if (!finalClassification) {
      toast.error("Enter or select a classification")
      return
    }
    if (!date) {
      toast.error("Select a date")
      return
    }

    setIsSubmitting(true)
    try {
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

      toast.success("Transaction added!", { description: `₹${amount} to ${receiver}` })
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
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg mx-auto p-0 border-4 border-black bg-white shadow-[8px_8px_0px_0px_#000] rounded-none">
        <DialogHeader className="bg-[#FFEE00] px-6 py-4 border-b-4 border-black">
          <DialogTitle className="text-xl font-black uppercase">ADD TRANSACTION</DialogTitle>
          <DialogDescription className="text-xs font-mono text-black/60">
            Manually add a new transaction to your records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-6">
          {/* Amount */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider">AMOUNT (₹)</label>
            <input
              type="text"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border-3 border-black px-4 py-3 text-lg font-bold bg-[#FFFDE6] placeholder:text-black/30 focus:outline-none focus:bg-[#FFEE00] transition-colors"
            />
          </div>

          {/* Receiver */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider">RECEIVER / MERCHANT</label>
            <input
              type="text"
              placeholder="e.g., Zomato, Amazon"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              className="w-full border-3 border-black px-4 py-3 text-sm font-bold bg-[#FFFDE6] placeholder:text-black/30 focus:outline-none focus:bg-[#FFEE00] transition-colors"
            />
          </div>

          {/* Classification */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider">CLASSIFICATION</label>
            <div className="relative">
              <input
                ref={classificationInputRef}
                type="text"
                placeholder="Type or select..."
                value={classificationInput}
                onChange={(e) => {
                  setClassificationInput(e.target.value)
                  setClassification("")
                  setIsClassificationOpen(true)
                }}
                onFocus={() => setIsClassificationOpen(true)}
                className="w-full border-3 border-black px-4 py-3 text-sm font-bold bg-[#FFFDE6] placeholder:text-black/30 focus:outline-none focus:bg-[#FFEE00] transition-colors"
              />

              {isClassificationOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 mt-1 w-full border-3 border-black bg-white max-h-48 overflow-y-auto shadow-[4px_4px_0px_0px_#000]"
                >
                  {isCustomValue && classificationInput.trim() && (
                    <button
                      type="button"
                      onClick={() => selectClassification(classificationInput.trim())}
                      className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-[#00FF88] border-b-2 border-black/10"
                    >
                      + CREATE &quot;{classificationInput.trim()}&quot;
                    </button>
                  )}
                  {filteredClassifications.map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => selectClassification(cat)}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs font-bold hover:bg-[#FFEE00] border-b border-black/5 transition-colors",
                        classification === cat && "bg-[#FFEE00]"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider">DATE</label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen} modal={true}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full border-3 border-black px-4 py-3 text-sm font-bold text-left bg-[#FFFDE6] hover:bg-[#FFEE00] transition-colors",
                      !date && "text-black/30"
                    )}
                  >
                    {date ? format(date, "dd MMM yyyy") : "Pick date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 border-3 border-black shadow-[4px_4px_0px_0px_#000]"
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

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider">TIME</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border-3 border-black px-4 py-3 text-sm font-bold bg-[#FFFDE6] focus:outline-none focus:bg-[#FFEE00] transition-colors"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 px-6 py-4 border-t-4 border-black bg-[#F5F3E0]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-sm font-black uppercase border-3 border-black px-5 py-2.5 bg-white hover:bg-[#FF3366] hover:text-white transition-colors disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-sm font-black uppercase border-3 border-black px-5 py-2.5 bg-[#00FF88] hover:bg-[#00CC66] transition-colors disabled:opacity-50 brutal-shadow-sm"
          >
            {isSubmitting ? "ADDING..." : "ADD TRANSACTION"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

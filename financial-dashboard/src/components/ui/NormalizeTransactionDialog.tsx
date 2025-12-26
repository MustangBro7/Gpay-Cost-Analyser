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
import { Plus, X } from "lucide-react"
import { Transaction } from "@/types/Transaction"

interface Payer {
  name: string
  amount: string
}

interface NormalizeTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction
  onSuccess: () => void
}

export function NormalizeTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: NormalizeTransactionDialogProps) {
  const [payers, setPayers] = React.useState<Payer[]>(
    transaction.Payers || []
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const website_url = process.env.NEXT_PUBLIC_API_URL

  // Reset form when transaction changes or dialog opens
  React.useEffect(() => {
    if (open) {
      setPayers(transaction.Payers || [])
    }
  }, [open, transaction])

  // Calculate paid to me as sum of all payer amounts
  const calculatePaidToMe = React.useMemo(() => {
    return payers.reduce((sum, payer) => {
      const amount = parseFloat(payer.amount.replace(/,/g, "")) || 0
      return sum + amount
    }, 0)
  }, [payers])

  const addPayer = () => {
    setPayers([...payers, { name: "", amount: "" }])
  }

  const removePayer = (index: number) => {
    setPayers(payers.filter((_, i) => i !== index))
  }

  const updatePayer = (index: number, field: "name" | "amount", value: string) => {
    const updated = [...payers]
    updated[index] = { ...updated[index], [field]: value }
    setPayers(updated)
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      // Filter out empty payers
      const validPayers = payers.filter((p) => p.name.trim() && p.amount.trim())
      
      console.log("Sending normalization request:", {
        original: transaction,
        paidToMe: calculatePaidToMe,
        payers: validPayers,
        expectedNetAmount: netAmount
      })
      
      // Create a transaction object with the calculated original amount
      const transactionWithOriginal = {
        ...transaction,
        OriginalAmount: transaction.OriginalAmount || String(originalAmount),
      }
      
      const response = await fetch(`${website_url}/normalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original: transactionWithOriginal,
          paidToMe: calculatePaidToMe > 0 ? String(calculatePaidToMe) : null,
          payers: validPayers.length > 0 ? validPayers : null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Normalization failed:", errorText)
        throw new Error(`Failed to normalize transaction: ${errorText}`)
      }

      const result = await response.json()
      console.log("Normalization response:", result)
      
      // Verify the amount was updated
      if (result.updated_transaction) {
        console.log("Updated transaction:", result.updated_transaction)
        console.log("New Amount field:", result.updated_transaction.Amount)
      }

      toast("Transaction normalized!", {
        description: `Updated amount to ₹${netAmount.toFixed(2)}`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error("Normalization error:", err)
      toast("Failed to normalize transaction.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get original amount (never changes, fetched from backend)
  // Original = Net Amount (current Amount) + Paid to Me
  const originalAmount = React.useMemo(() => {
    // If OriginalAmount exists in transaction, use it (this is the true original)
    if (transaction.OriginalAmount) {
      return parseFloat(transaction.OriginalAmount.replace(/,/g, "")) || 0
    }
    // Otherwise, calculate: original = current Amount (net) + existing PaidToMe
    const currentAmount = parseFloat(transaction.Amount.replace(/,/g, "")) || 0
    const existingPaidToMe = parseFloat(transaction.PaidToMe?.replace(/,/g, "") || "0") || 0
    // Current Amount is the net amount, so add PaidToMe to get original
    return currentAmount + existingPaidToMe
  }, [transaction])

  const paidToMeAmount = calculatePaidToMe
  const netAmount = originalAmount - paidToMeAmount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Normalize Transaction</DialogTitle>
          <DialogDescription>
            Adjust the transaction amount by specifying how much was paid to you and by whom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transaction Info */}
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Original Amount:</span>
              <span className="text-lg font-bold">₹{originalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Receiver:</span>
              <span className="text-sm">{transaction.Receiver}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Date:</span>
              <span className="text-sm">
                {new Date(transaction.Date).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Classification:</span>
              <span className="text-sm">{transaction.Classification}</span>
            </div>
          </div>

          {/* Paid to Me (Auto-calculated) */}
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Paid to Me (Auto-calculated):</span>
              <span className="text-lg font-bold">₹{paidToMeAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm font-medium">Net Amount (will be updated):</span>
              <span className="text-lg font-bold text-primary">₹{netAmount.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              The transaction amount will be updated to the net amount in all charts and displays.
            </p>
          </div>

          {/* Payers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Payers</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPayer}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Payer
              </Button>
            </div>

            {payers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No payers added. Click "Add Payer" to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {payers.map((payer, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-center p-3 border rounded-md bg-card"
                  >
                    <Input
                      placeholder="Payer name"
                      value={payer.name}
                      onChange={(e) =>
                        updatePayer(index, "name", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Input
                      placeholder="Amount"
                      type="text"
                      value={payer.amount}
                      onChange={(e) =>
                        updatePayer(index, "amount", e.target.value)
                      }
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePayer(index)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


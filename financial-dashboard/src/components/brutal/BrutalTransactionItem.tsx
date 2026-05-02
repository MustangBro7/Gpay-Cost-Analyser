'use client'

import * as React from "react"
import { toast } from "sonner"
import { Transaction } from "@/types/Transaction"
import { NormalizeTransactionDialog } from "@/components/ui/NormalizeTransactionDialog"
import { useAuthedFetch } from "@/lib/useAuthedFetch"

export function BrutalTransactionItem({
  tx,
  refetch,
}: {
  tx: Transaction
  refetch: () => void
}) {
  const [newClass, setNewClass] = React.useState("")
  const [normalizeDialogOpen, setNormalizeDialogOpen] = React.useState(false)
  const website_url = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()

  const handleReclassify = async () => {
    if (!newClass.trim()) return
    try {
      await authedFetch(`${website_url}/reclassify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original: tx,
          newClassification: newClass,
        }),
      })

      toast("Reclassification submitted!", {
        description: `Updated "${tx.Classification}" → "${newClass}"`,
      })
      setNewClass("")
      refetch()
    } catch (err) {
      console.error(err)
      toast("Failed to submit reclassification.")
    }
  }

  return (
    <>
      <li className="border-3 border-black p-3 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-black text-sm">₹{tx.Amount}</span>
            <span className="text-xs font-bold text-black/60 ml-2">→ {tx.Receiver}</span>
          </div>
          <span className="text-[10px] font-mono text-black/40">
            {new Date(tx.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        <div className="text-[10px] font-mono text-black/40 mt-1 uppercase">
          {tx.Classification}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            placeholder="New class..."
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            className="flex-1 border-2 border-black px-2 py-1 text-xs font-bold bg-[#FFFDE6] placeholder:text-black/30 focus:outline-none focus:bg-[#FFEE00]"
          />
          <button
            onClick={handleReclassify}
            className="text-[10px] font-black uppercase border-2 border-black px-2 py-1 bg-[#00CCFF] hover:bg-[#00FF88] transition-colors"
          >
            RECLASSIFY
          </button>
          <button
            onClick={() => setNormalizeDialogOpen(true)}
            className="text-[10px] font-black uppercase border-2 border-black px-2 py-1 bg-[#FFEE00] hover:bg-[#FF6600] hover:text-white transition-colors"
          >
            NORMALIZE
          </button>
        </div>
      </li>
      <NormalizeTransactionDialog
        open={normalizeDialogOpen}
        onOpenChange={setNormalizeDialogOpen}
        transaction={tx}
        onSuccess={refetch}
      />
    </>
  )
}

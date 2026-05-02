'use client'

import * as React from "react"
import { Transaction } from "@/types/Transaction"

export function BrutalStatsRow({ data }: { data: Transaction[] }) {
  const stats = React.useMemo(() => {
    const total = data.reduce((acc, tx) => acc + (parseFloat(tx.Amount.replace(/,/g, "")) || 0), 0)
    const categories = new Set(data.map((tx) => tx.Classification)).size
    const avgPerTx = data.length > 0 ? total / data.length : 0

    // Find biggest category
    const grouped: Record<string, number> = {}
    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      grouped[tx.Classification] = (grouped[tx.Classification] || 0) + amt
    })
    const biggest = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0]

    return { total, categories, avgPerTx, biggest, txCount: data.length }
  }, [data])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="brutal-border bg-white p-4 brutal-shadow-sm">
        <p className="text-[10px] font-black uppercase text-black/50 tracking-wider">TOTAL SPENT</p>
        <p className="text-2xl sm:text-3xl font-black mt-1">₹{stats.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
      </div>
      <div className="brutal-border bg-[#FF3366] text-white p-4 brutal-shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-wider opacity-80">TRANSACTIONS</p>
        <p className="text-2xl sm:text-3xl font-black mt-1">{stats.txCount}</p>
      </div>
      <div className="brutal-border bg-[#00FF88] p-4 brutal-shadow-sm">
        <p className="text-[10px] font-black uppercase text-black/60 tracking-wider">CATEGORIES</p>
        <p className="text-2xl sm:text-3xl font-black mt-1">{stats.categories}</p>
      </div>
      <div className="brutal-border bg-[#FFEE00] p-4 brutal-shadow-sm">
        <p className="text-[10px] font-black uppercase text-black/60 tracking-wider">AVG / TX</p>
        <p className="text-2xl sm:text-3xl font-black mt-1">₹{stats.avgPerTx.toFixed(0)}</p>
      </div>
    </div>
  )
}

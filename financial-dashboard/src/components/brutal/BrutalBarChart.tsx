'use client'

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts"
import { Transaction } from "@/types/Transaction"
import { BrutalTransactionItem } from "./BrutalTransactionItem"
import { format } from "date-fns"

const BRUTAL_COLORS = [
  "#FF3366", "#00FF88", "#FFEE00", "#00CCFF", "#FF6600",
  "#CC00FF", "#FF0000", "#00FF00", "#0066FF", "#FF00FF",
  "#FFAA00", "#00FFCC"
]

export function BrutalBarChart({
  data = [],
  refetch,
}: {
  data: Transaction[]
  refetch: () => void
}) {
  const grouped = React.useMemo(() => {
    const map: Record<string, number> = {}
    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      map[tx.Classification] = (map[tx.Classification] || 0) + amt
    })
    return Object.entries(map)
      .map(([Classification, total]) => ({ Classification, total }))
      .sort((a, b) => b.total - a.total)
  }, [data])

  const [selected, setSelected] = React.useState<{ classification: string; total: number } | null>(null)

  const filtered = React.useMemo(
    () => selected ? data.filter((d) => d.Classification === selected.classification) : [],
    [selected, data]
  )

  // Pagination
  const pageSize = 6
  const [currentPage, setCurrentPage] = React.useState(0)
  const totalPages = Math.ceil(grouped.length / pageSize)
  const paginated = grouped.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  const dateRange = React.useMemo(() => {
    if (!data || data.length === 0) return null
    const dates = data.map((tx) => new Date(tx.Date))
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
    return { from: format(minDate, "d MMM yyyy"), to: format(maxDate, "d MMM yyyy") }
  }, [data])

  return (
    <div className="brutal-border bg-white brutal-shadow">
      {/* Header */}
      <div className="bg-black text-white px-5 py-3 flex items-center justify-between">
        <h2 className="font-black uppercase text-sm">WHERE IT WENT</h2>
        <span className="text-[10px] font-mono text-[#00FF88]">
          {dateRange ? `${dateRange.from} → ${dateRange.to}` : "No data"}
        </span>
      </div>

      {/* Chart */}
      <div className="p-5">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={paginated} layout="vertical" margin={{ left: 10, right: 30 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="Classification"
              tick={{ fontSize: 11, fontWeight: 700, fill: '#000' }}
              width={120}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#000',
                border: '3px solid #FFEE00',
                borderRadius: '0',
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
            />
            <Bar
              dataKey="total"
              radius={0}
              onClick={(entry) => setSelected({ classification: entry.Classification, total: entry.total })}
              style={{ cursor: 'pointer' }}
            >
              {paginated.map((_, index) => (
                <Cell key={index} fill={BRUTAL_COLORS[index % BRUTAL_COLORS.length]} stroke="#000" strokeWidth={2} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-3 border-t-3 border-black">
            <button
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              className="text-xs font-black uppercase border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-[#FFEE00] transition-colors"
            >
              ← PREV
            </button>
            <span className="text-xs font-mono font-bold">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages - 1}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
              className="text-xs font-black uppercase border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-[#FFEE00] transition-colors"
            >
              NEXT →
            </button>
          </div>
        )}
      </div>

      {/* Drilldown */}
      {selected && (
        <div className="border-t-4 border-black bg-[#FFFDE6] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase">{selected.classification}</h4>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold">₹{selected.total.toLocaleString()}</span>
              <button
                onClick={() => setSelected(null)}
                className="text-xs font-black border-2 border-black px-2 py-0.5 hover:bg-[#FF3366] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <ul className="space-y-2 max-h-[250px] overflow-y-auto">
            {filtered.map((tx, i) => (
              <BrutalTransactionItem key={i} tx={tx} refetch={refetch} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

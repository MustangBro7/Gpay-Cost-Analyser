'use client'

import * as React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Transaction } from "@/types/Transaction"
import { BrutalTransactionItem } from "./BrutalTransactionItem"

const BRUTAL_COLORS = [
  "#FF3366", "#00FF88", "#FFEE00", "#00CCFF", "#FF6600",
  "#CC00FF", "#FF0000", "#00FF00", "#0066FF", "#FF00FF",
  "#FFAA00", "#00FFCC"
]

export function BrutalPieChart({
  data,
  refetch,
}: {
  data: Transaction[]
  refetch: () => void
}) {
  const safeData = React.useMemo(() => (Array.isArray(data) ? data : []), [data])

  const parsedData = React.useMemo(() => {
    const grouped = safeData.reduce((acc, curr) => {
      const key = curr.Classification
      const amt = parseFloat(curr.Amount.replace(/,/g, ""))
      acc[key] = (acc[key] || 0) + amt
      return acc
    }, {} as Record<string, number>)

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [safeData])

  const total = parsedData.reduce((acc, curr) => acc + curr.value, 0)
  const [selected, setSelected] = React.useState<{ name: string; value: number } | null>(null)

  const filteredTransactions = React.useMemo(() => {
    if (!selected) return []
    return safeData.filter((d) => d.Classification === selected.name)
  }, [selected, safeData])

  return (
    <div className="brutal-border bg-[#00CCFF] brutal-shadow">
      {/* Header */}
      <div className="bg-black text-white px-5 py-3 flex items-center justify-between">
        <h2 className="font-black uppercase text-sm">THE PIE</h2>
        <span className="text-[10px] font-mono text-[#FFEE00]">{parsedData.length} categories</span>
      </div>

      {/* Chart */}
      <div className="p-5">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={parsedData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="value"
              stroke="#000"
              strokeWidth={3}
              onClick={(entry) => setSelected({ name: entry.name, value: entry.value })}
              style={{ cursor: 'pointer' }}
            >
              {parsedData.map((_, index) => (
                <Cell key={index} fill={BRUTAL_COLORS[index % BRUTAL_COLORS.length]} />
              ))}
            </Pie>
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
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-1.5">
          {parsedData.slice(0, 8).map((item, i) => (
            <div
              key={item.name}
              className="flex items-center gap-2 text-[10px] font-bold cursor-pointer hover:bg-black/10 px-1.5 py-1 transition-colors"
              onClick={() => setSelected({ name: item.name, value: item.value })}
            >
              <div className="w-3 h-3 border-2 border-black flex-shrink-0" style={{ background: BRUTAL_COLORS[i % BRUTAL_COLORS.length] }} />
              <span className="truncate uppercase">{item.name}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-4 pt-3 border-t-3 border-black text-center">
          <p className="text-xs font-bold uppercase text-black/60">TOTAL</p>
          <p className="text-2xl font-black">₹{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Drilldown */}
      {selected && (
        <div className="border-t-4 border-black bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase">{selected.name}</h4>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold">₹{selected.value.toLocaleString()}</span>
              <button
                onClick={() => setSelected(null)}
                className="text-xs font-black border-2 border-black px-2 py-0.5 hover:bg-[#FF3366] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <ul className="space-y-2 max-h-[250px] overflow-y-auto">
            {filteredTransactions.map((tx, idx) => (
              <BrutalTransactionItem key={idx} tx={tx} refetch={refetch} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

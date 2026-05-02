'use client'

import * as React from "react"
import { sampleTransactions } from "@/data/sampleTransactions"
import { Transaction } from "@/types/Transaction"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"
import Link from "next/link"

// --- DESIGN 3: NEO BRUTALIST ---
// Bold borders, raw typography, clashing colors, intentionally rough edges

function useGroupedData(data: Transaction[]) {
  return React.useMemo(() => {
    const grouped: Record<string, number> = {}
    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      grouped[tx.Classification] = (grouped[tx.Classification] || 0) + amt
    })
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [data])
}

function useDailyData(data: Transaction[]) {
  return React.useMemo(() => {
    const map: Record<string, number> = {}
    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      const date = new Date(tx.Date).toISOString().split("T")[0]
      map[date] = (map[date] || 0) + amt
    })
    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data])
}

const BRUTAL_COLORS = [
  "#FF3366", "#00FF88", "#FFEE00", "#00CCFF", "#FF6600",
  "#CC00FF", "#FF0000", "#00FF00", "#0066FF", "#FF00FF",
  "#FFAA00", "#00FFCC"
]

export default function Design3() {
  const data = sampleTransactions
  const grouped = useGroupedData(data)
  const daily = useDailyData(data)
  const total = grouped.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <div className="min-h-screen bg-[#FFFDE6] text-black relative">
      {/* Decorative elements */}
      <div className="fixed top-20 right-20 w-40 h-40 border-4 border-black rotate-12 opacity-5" />
      <div className="fixed bottom-40 left-10 w-60 h-60 bg-[#FF3366] rounded-full opacity-[0.03]" />

      {/* Nav */}
      <nav className="border-b-4 border-black px-6 py-4 flex items-center justify-between bg-[#FFEE00]">
        <Link href="/designs" className="text-sm font-bold uppercase hover:line-through transition-all">
          ← BACK
        </Link>
        <h1 className="text-2xl font-black uppercase tracking-tight">
          MONEY<span className="text-[#FF3366]">.</span>TRACKER
        </h1>
        <span className="text-xs font-mono font-bold bg-black text-[#FFEE00] px-2 py-1">MAY 2026</span>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-10 border-4 border-black p-8 bg-white shadow-[8px_8px_0px_0px_#000]">
          <p className="text-sm font-mono uppercase tracking-wider text-black/50 mb-1">YOU SPENT</p>
          <div className="flex items-end gap-4">
            <span className="text-8xl font-black leading-none tracking-tighter">
              ₹{total.toLocaleString()}
            </span>
            <span className="text-xl font-bold text-[#FF3366] mb-2 rotate-[-3deg]">this month!</span>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Bar Chart */}
          <div className="col-span-7 border-4 border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]">
            <h2 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
              <span className="inline-block w-4 h-4 bg-[#FF3366]" />
              WHERE IT WENT
            </h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={grouped.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#000' }}
                  width={130}
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
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                />
                <Bar dataKey="value" radius={0}>
                  {grouped.slice(0, 8).map((_, index) => (
                    <Cell key={index} fill={BRUTAL_COLORS[index % BRUTAL_COLORS.length]} stroke="#000" strokeWidth={2} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie + Stats */}
          <div className="col-span-5 space-y-6">
            {/* Pie */}
            <div className="border-4 border-black bg-[#00CCFF] p-6 shadow-[6px_6px_0px_0px_#000]">
              <h2 className="text-lg font-black uppercase mb-2 text-black">THE PIE</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={grouped}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    stroke="#000"
                    strokeWidth={3}
                  >
                    {grouped.map((_, index) => (
                      <Cell key={index} fill={BRUTAL_COLORS[index % BRUTAL_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-4 border-black bg-[#FF3366] p-4 shadow-[4px_4px_0px_0px_#000] text-white">
                <p className="text-xs font-bold uppercase">BIGGEST</p>
                <p className="text-xl font-black mt-1">{grouped[0]?.name}</p>
                <p className="text-sm font-mono mt-1">₹{grouped[0]?.value.toLocaleString()}</p>
              </div>
              <div className="border-4 border-black bg-[#00FF88] p-4 shadow-[4px_4px_0px_0px_#000]">
                <p className="text-xs font-bold uppercase">SMALLEST</p>
                <p className="text-xl font-black mt-1">{grouped[grouped.length - 1]?.name}</p>
                <p className="text-sm font-mono mt-1">₹{grouped[grouped.length - 1]?.value.toLocaleString()}</p>
              </div>
              <div className="border-4 border-black bg-[#FFEE00] p-4 shadow-[4px_4px_0px_0px_#000]">
                <p className="text-xs font-bold uppercase">CATEGORIES</p>
                <p className="text-3xl font-black mt-1">{grouped.length}</p>
              </div>
              <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_#000]">
                <p className="text-xs font-bold uppercase">TRANSACTIONS</p>
                <p className="text-3xl font-black mt-1">{data.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Table - Brutalist Style */}
        <section className="mt-10 border-4 border-black bg-white shadow-[6px_6px_0px_0px_#000]">
          <div className="bg-black text-white px-6 py-3 flex items-center justify-between">
            <h2 className="font-black uppercase text-lg">ALL TRANSACTIONS</h2>
            <span className="font-mono text-sm text-[#FFEE00]">{data.length} records</span>
          </div>
          <div className="divide-y-2 divide-black max-h-[400px] overflow-y-auto">
            {data.map((tx, i) => (
              <div key={i} className="flex items-center px-6 py-3 hover:bg-[#FFEE00]/30 transition-colors">
                <span className="w-8 text-xs font-mono font-bold text-black/30">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 font-bold text-sm">{tx.Receiver}</span>
                <span className="w-40 text-xs font-mono px-2 py-1 border-2 border-black bg-[#FFFDE6] text-center font-bold">
                  {tx.Classification}
                </span>
                <span className="w-28 text-right font-black text-lg">₹{tx.Amount}</span>
                <span className="w-24 text-right text-xs font-mono text-black/40">
                  {new Date(tx.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

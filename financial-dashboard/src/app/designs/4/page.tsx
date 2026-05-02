'use client'

import * as React from "react"
import { sampleTransactions } from "@/data/sampleTransactions"
import { Transaction } from "@/types/Transaction"
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import Link from "next/link"

// --- DESIGN 4: ZEN GARDEN ---
// Ultra-minimal, Japanese-inspired. Generous whitespace, delicate lines, muted earth tones.

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

const ZEN_PALETTE = [
  "#8B7355", "#6B8E6B", "#B8A088", "#7BA3A3", "#C4956A",
  "#9CAF88", "#A0826D", "#7C9A92", "#BFA98E", "#6B7B6B",
  "#D4B896", "#8FA3A3"
]

export default function Design4() {
  const data = sampleTransactions
  const grouped = useGroupedData(data)
  const daily = useDailyData(data)
  const total = grouped.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#3D3529] relative">
      {/* Subtle decorative circle */}
      <div className="fixed top-1/2 right-[-200px] -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[#E8E2DA] opacity-40" />
      <div className="fixed top-1/2 right-[-180px] -translate-y-1/2 w-[560px] h-[560px] rounded-full border border-[#E8E2DA] opacity-20" />

      {/* Nav */}
      <nav className="px-12 py-8 flex items-center justify-between">
        <Link href="/designs" className="text-xs text-[#8B7355]/60 hover:text-[#8B7355] transition-colors tracking-wider">
          ← return
        </Link>
        <div className="text-center">
          <h1 className="text-sm tracking-[0.5em] uppercase text-[#8B7355]/70 font-light">支出</h1>
          <p className="text-[10px] text-[#8B7355]/40 mt-0.5 tracking-wider">expenditure</p>
        </div>
        <span className="text-xs text-[#8B7355]/40 tracking-wider">五月</span>
      </nav>

      <main className="max-w-[1200px] mx-auto px-12 py-4">
        {/* Total - Centered, breathing */}
        <div className="text-center mb-20">
          <p className="text-xs tracking-[0.4em] uppercase text-[#8B7355]/40 mb-6">this month</p>
          <p className="text-6xl font-extralight tracking-tight text-[#3D3529]">
            ₹{total.toLocaleString()}
          </p>
          <div className="mt-8 mx-auto w-16 h-px bg-[#8B7355]/20" />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-20">
          {/* Left - Flow */}
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-[#8B7355]/40 mb-8">daily rhythm</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="zenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B7355" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#8B7355" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8B7355', fontSize: 9, opacity: 0.4 }}
                  tickFormatter={(v) => new Date(v).getDate().toString()}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: '#FAF8F5',
                    border: '1px solid #E8E2DA',
                    borderRadius: '4px',
                    color: '#3D3529',
                    fontSize: '12px',
                    boxShadow: 'none',
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#8B7355"
                  strokeWidth={1.5}
                  fill="url(#zenGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Minimal separator */}
            <div className="my-12 w-8 h-px bg-[#8B7355]/15" />

            {/* Category List - Minimal */}
            <p className="text-[10px] tracking-[0.4em] uppercase text-[#8B7355]/40 mb-6">categories</p>
            <div className="space-y-5">
              {grouped.map((item, i) => (
                <div key={item.name} className="group">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm text-[#3D3529]/70 group-hover:text-[#3D3529] transition-colors">{item.name}</span>
                    <span className="text-xs text-[#8B7355]/50 font-light">₹{item.value.toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-[#E8E2DA] relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#8B7355]/30 transition-all duration-1000 ease-out"
                      style={{ width: `${(item.value / grouped[0].value) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Composition */}
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-[#8B7355]/40 mb-8">composition</p>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={grouped}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    dataKey="value"
                    stroke="#FAF8F5"
                    strokeWidth={2}
                  >
                    {grouped.map((_, index) => (
                      <Cell key={index} fill={ZEN_PALETTE[index % ZEN_PALETTE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Minimal separator */}
            <div className="my-12 w-8 h-px bg-[#8B7355]/15 ml-auto" />

            {/* Recent - Haiku style */}
            <p className="text-[10px] tracking-[0.4em] uppercase text-[#8B7355]/40 mb-6">recent</p>
            <div className="space-y-6">
              {data.slice(0, 7).map((tx, i) => (
                <div key={i} className="flex items-baseline justify-between border-b border-[#E8E2DA]/50 pb-4">
                  <div>
                    <p className="text-sm text-[#3D3529]/80">{tx.Receiver}</p>
                    <p className="text-[10px] text-[#8B7355]/40 mt-1 tracking-wider">
                      {new Date(tx.Date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <span className="text-sm font-light text-[#3D3529]/60">₹{tx.Amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer breathing space */}
        <div className="mt-24 text-center">
          <div className="mx-auto w-1 h-1 rounded-full bg-[#8B7355]/20" />
        </div>
      </main>
    </div>
  )
}

'use client'

import * as React from "react"
import { sampleTransactions } from "@/data/sampleTransactions"
import { Transaction } from "@/types/Transaction"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, Area, AreaChart } from "recharts"
import Link from "next/link"

// --- DESIGN 1: NOIR LEDGER ---
// Dark, cinematic dashboard with dramatic shadows, gold accents, editorial typography

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

const GOLD_PALETTE = [
  "#D4AF37", "#C5A028", "#B8860B", "#DAA520", "#FFD700",
  "#E6BE44", "#BFA14A", "#A68B2C", "#8B7536", "#7A6420",
  "#F5D060", "#CDAA3D"
]

export default function Design1() {
  const data = sampleTransactions
  const grouped = useGroupedData(data)
  const daily = useDailyData(data)
  const total = grouped.reduce((acc, curr) => acc + curr.value, 0)
  const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-[#E8E4DC] relative overflow-hidden">
      {/* Subtle grain overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-50" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
      }} />

      {/* Dramatic top light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D4AF37]/5 rounded-full blur-[120px]" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/[0.04]">
        <Link href="/designs" className="text-xs tracking-[0.3em] uppercase text-white/30 hover:text-white/60 transition-colors">
          ← Back to Designs
        </Link>
        <h1 className="font-serif text-sm tracking-[0.2em] uppercase text-[#D4AF37]/80">Noir Ledger</h1>
        <span className="text-xs text-white/20 font-mono">May 2026</span>
      </nav>

      <main className="relative z-10 max-w-[1400px] mx-auto px-8 py-10">
        {/* Hero Stats */}
        <header className="mb-16">
          <p className="text-xs tracking-[0.4em] uppercase text-white/30 mb-3 font-mono">Total Expenditure</p>
          <div className="flex items-baseline gap-4">
            <span className="text-7xl font-serif font-light tracking-tight text-[#D4AF37]">
              ₹{total.toLocaleString()}
            </span>
            <span className="text-sm text-white/30 font-mono">this month</span>
          </div>
          <div className="mt-4 h-px bg-gradient-to-r from-[#D4AF37]/40 via-[#D4AF37]/10 to-transparent w-96" />
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-8">
          {/* Donut Chart - Left */}
          <div className="col-span-5">
            <div className="relative p-8 rounded-2xl border border-white/[0.06] bg-[#0F0F14]/80 backdrop-blur-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
              <h2 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-8 font-mono">Allocation</h2>
              <div className="relative">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={grouped}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={140}
                      dataKey="value"
                      stroke="none"
                      onMouseEnter={(_, index) => setHoveredCategory(grouped[index].name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {grouped.map((_, index) => (
                        <Cell
                          key={index}
                          fill={GOLD_PALETTE[index % GOLD_PALETTE.length]}
                          opacity={hoveredCategory === null || hoveredCategory === grouped[index].name ? 1 : 0.3}
                          style={{ transition: 'opacity 0.3s ease' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-serif text-[#D4AF37]">
                      {hoveredCategory ? grouped.find(g => g.name === hoveredCategory)?.name : grouped.length}
                    </p>
                    <p className="text-xs text-white/30 mt-1">
                      {hoveredCategory
                        ? `₹${grouped.find(g => g.name === hoveredCategory)?.value.toLocaleString()}`
                        : "categories"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-7 space-y-8">
            {/* Area Chart */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-[#0F0F14]/80 backdrop-blur-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
              <h2 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-6 font-mono">Daily Flow</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                    tickFormatter={(v) => new Date(v).getDate().toString()}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', color: '#E8E4DC' }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Spent']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={2} fill="url(#goldGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Category Bars */}
            <div className="p-8 rounded-2xl border border-white/[0.06] bg-[#0F0F14]/80 backdrop-blur-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
              <h2 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-6 font-mono">Breakdown</h2>
              <div className="space-y-4">
                {grouped.slice(0, 8).map((item, i) => (
                  <div key={item.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-white/70 group-hover:text-[#D4AF37] transition-colors">{item.name}</span>
                      <span className="text-sm font-mono text-[#D4AF37]/80">₹{item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${(item.value / grouped[0].value) * 100}%`,
                          background: `linear-gradient(90deg, ${GOLD_PALETTE[i % GOLD_PALETTE.length]}, ${GOLD_PALETTE[i % GOLD_PALETTE.length]}88)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <section className="mt-12">
          <h2 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-6 font-mono">Recent Transactions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.slice(0, 9).map((tx, i) => (
              <div
                key={i}
                className="p-5 rounded-xl border border-white/[0.04] bg-[#0F0F14]/60 hover:border-[#D4AF37]/20 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80 group-hover:text-[#D4AF37] transition-colors">{tx.Receiver}</p>
                    <p className="text-xs text-white/30 mt-1">{tx.Classification}</p>
                  </div>
                  <span className="text-lg font-serif text-[#D4AF37]/90">₹{tx.Amount}</span>
                </div>
                <p className="text-[10px] text-white/20 mt-3 font-mono">
                  {new Date(tx.Date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

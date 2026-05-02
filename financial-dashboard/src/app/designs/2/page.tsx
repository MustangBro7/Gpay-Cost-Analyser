'use client'

import * as React from "react"
import { sampleTransactions } from "@/data/sampleTransactions"
import { Transaction } from "@/types/Transaction"
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import Link from "next/link"

// --- DESIGN 2: GLASSMORPHIC AURORA ---
// Frosted glass cards over animated gradient mesh. Ethereal, modern, translucent.

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

const AURORA_PALETTE = [
  "#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EC4899",
  "#8B5CF6", "#14B8A6", "#22C55E", "#EAB308", "#F43F5E",
  "#A78BFA", "#67E8F9"
]

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-3xl border border-white/[0.12] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ${className}`}>
      {/* Inner glow */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default function Design2() {
  const data = sampleTransactions
  const grouped = useGroupedData(data)
  const daily = useDailyData(data)
  const total = grouped.reduce((acc, curr) => acc + curr.value, 0)
  const topCategories = grouped.slice(0, 4)

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 bg-[#0F0720]">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[30%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/15 blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[700px] h-[700px] rounded-full bg-emerald-500/10 blur-[140px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        <div className="absolute top-[60%] left-[10%] w-[300px] h-[300px] rounded-full bg-pink-500/10 blur-[80px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6">
          <Link href="/designs" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            ← Back
          </Link>
          <h1 className="text-lg font-light tracking-wide text-white/80">
            <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Aurora Finance
            </span>
          </h1>
          <span className="text-xs text-white/30">May 2026</span>
        </nav>

        <main className="max-w-[1400px] mx-auto px-8 py-6">
          {/* Top Stats Row */}
          <div className="grid grid-cols-4 gap-5 mb-8">
            <GlassCard className="p-6 col-span-2">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Monthly Spend</p>
              <p className="text-5xl font-extralight text-white tracking-tight">
                ₹{total.toLocaleString()}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400/80">Active tracking</span>
              </div>
            </GlassCard>

            {topCategories.slice(0, 2).map((cat, i) => (
              <GlassCard key={cat.name} className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: AURORA_PALETTE[i] }} />
                  <p className="text-xs text-white/40 uppercase tracking-wider truncate">{cat.name}</p>
                </div>
                <p className="text-2xl font-light text-white">₹{cat.value.toLocaleString()}</p>
                <p className="text-xs text-white/30 mt-1">{((cat.value / total) * 100).toFixed(1)}% of total</p>
              </GlassCard>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-12 gap-6">
            {/* Spending Trend */}
            <GlassCard className="col-span-8 p-8">
              <h2 className="text-sm text-white/50 uppercase tracking-wider mb-6">Spending Trend</h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={daily} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="auroraGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.4} />
                      <stop offset="50%" stopColor="#06B6D4" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,7,32,0.9)',
                      border: '1px solid rgba(124,58,237,0.3)',
                      borderRadius: '12px',
                      color: '#fff',
                      backdropFilter: 'blur(10px)',
                    }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Spent']}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="url(#auroraStroke)"
                    strokeWidth={2.5}
                    fill="url(#auroraGrad)"
                  />
                  <defs>
                    <linearGradient id="auroraStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7C3AED" />
                      <stop offset="50%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Donut */}
            <GlassCard className="col-span-4 p-8">
              <h2 className="text-sm text-white/50 uppercase tracking-wider mb-4">Categories</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={grouped}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                  >
                    {grouped.map((_, index) => (
                      <Cell key={index} fill={AURORA_PALETTE[index % AURORA_PALETTE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="mt-4 space-y-2 max-h-[180px] overflow-y-auto pr-2">
                {grouped.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: AURORA_PALETTE[i % AURORA_PALETTE.length] }} />
                      <span className="text-white/60 truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <span className="text-white/40 font-mono">₹{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Transaction List */}
          <div className="mt-8">
            <h2 className="text-sm text-white/50 uppercase tracking-wider mb-5">Recent Activity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.slice(0, 8).map((tx, i) => (
                <GlassCard key={i} className="p-5 hover:border-purple-500/30 transition-all duration-300 cursor-pointer group">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: `${AURORA_PALETTE[i % AURORA_PALETTE.length]}33` }}
                    >
                      {tx.Receiver.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">{tx.Receiver}</p>
                      <p className="text-[10px] text-white/30">{tx.Classification}</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-light text-white">₹{tx.Amount}</span>
                    <span className="text-[10px] text-white/20">
                      {new Date(tx.Date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

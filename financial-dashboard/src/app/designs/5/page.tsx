'use client'

import * as React from "react"
import { sampleTransactions } from "@/data/sampleTransactions"
import { Transaction } from "@/types/Transaction"
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts"
import Link from "next/link"

// --- DESIGN 5: RETRO TERMINAL ---
// CRT aesthetic, phosphor green, scanlines, monospace. Hacker vibes meet data viz.

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

const TERMINAL_COLORS = [
  "#00FF41", "#00CC33", "#009926", "#33FF66", "#66FF99",
  "#00FF80", "#00E639", "#00B32D", "#4DFF88", "#1AFF5C",
  "#80FFB3", "#00D936"
]

export default function Design5() {
  const data = sampleTransactions
  const grouped = useGroupedData(data)
  const daily = useDailyData(data)
  const total = grouped.reduce((acc, curr) => acc + curr.value, 0)
  const [currentTime, setCurrentTime] = React.useState("")

  React.useEffect(() => {
    const update = () => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#00FF41] font-mono relative overflow-hidden">
      {/* CRT Scanlines */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.04]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,65,0.03) 1px, rgba(0,255,65,0.03) 2px)',
        backgroundSize: '100% 2px',
      }} />

      {/* CRT Vignette */}
      <div className="fixed inset-0 pointer-events-none z-40" style={{
        background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Phosphor glow */}
      <div className="fixed inset-0 pointer-events-none z-30 opacity-[0.02]" style={{
        background: 'radial-gradient(ellipse at center, rgba(0,255,65,0.1) 0%, transparent 70%)',
      }} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header Bar */}
        <nav className="border-b border-[#00FF41]/20 px-6 py-3 flex items-center justify-between">
          <Link href="/designs" className="text-xs text-[#00FF41]/40 hover:text-[#00FF41]/80 transition-colors">
            [ESC] BACK
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#00FF41]/60">FINANCE_TERMINAL v2.6.0</span>
            <span className="text-xs text-[#00FF41]/30">|</span>
            <span className="text-xs text-[#00FF41]/40">{currentTime}</span>
          </div>
          <span className="text-xs text-[#00FF41]/30">SESSION: 0x4F2A</span>
        </nav>

        <main className="max-w-[1400px] mx-auto px-6 py-6">
          {/* System Status */}
          <div className="mb-8 flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-[#00FF41] animate-pulse shadow-[0_0_6px_#00FF41]" />
            <span className="text-xs text-[#00FF41]/60">SYSTEM ONLINE</span>
            <span className="text-xs text-[#00FF41]/30">•</span>
            <span className="text-xs text-[#00FF41]/40">MONITORING {data.length} TRANSACTIONS</span>
            <span className="text-xs text-[#00FF41]/30">•</span>
            <span className="text-xs text-[#00FF41]/40">PERIOD: MAY 2026</span>
          </div>

          {/* Total Display */}
          <div className="mb-10 p-6 border border-[#00FF41]/20 bg-[#00FF41]/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[#00FF41]/40">&gt; TOTAL_EXPENDITURE:</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-[#00FF41] drop-shadow-[0_0_10px_rgba(0,255,65,0.3)]">
                ₹{total.toLocaleString()}
              </span>
              <span className="text-sm text-[#00FF41]/30 animate-pulse">█</span>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-12 gap-6">
            {/* Area Chart */}
            <div className="col-span-8 border border-[#00FF41]/15 p-5 bg-[#00FF41]/[0.01]">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-[#00FF41]/40">[GRAPH]</span>
                <span className="text-xs text-[#00FF41]/70">DAILY_SPEND_ANALYSIS</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={daily} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="termGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00FF41" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#00FF41" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,255,65,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#00FF41', fontSize: 9, opacity: 0.4 }}
                    tickFormatter={(v) => new Date(v).getDate().toString().padStart(2, '0')}
                    axisLine={{ stroke: 'rgba(0,255,65,0.15)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#00FF41', fontSize: 9, opacity: 0.3 }}
                    axisLine={{ stroke: 'rgba(0,255,65,0.15)' }}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0A0A0A',
                      border: '1px solid rgba(0,255,65,0.4)',
                      borderRadius: '0',
                      color: '#00FF41',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                    labelFormatter={(v) => `DATE: ${v}`}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'AMOUNT']}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="total"
                    stroke="#00FF41"
                    strokeWidth={1.5}
                    fill="url(#termGrad)"
                    dot={{ fill: '#00FF41', r: 2, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pie */}
            <div className="col-span-4 border border-[#00FF41]/15 p-5 bg-[#00FF41]/[0.01]">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-[#00FF41]/40">[PIE]</span>
                <span className="text-xs text-[#00FF41]/70">ALLOCATION</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={grouped}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    stroke="#0A0A0A"
                    strokeWidth={1}
                  >
                    {grouped.map((_, index) => (
                      <Cell key={index} fill={TERMINAL_COLORS[index % TERMINAL_COLORS.length]} opacity={0.7 + (index * 0.02)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="mt-3 space-y-1 max-h-[140px] overflow-y-auto">
                {grouped.slice(0, 6).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-[10px]">
                    <span className="text-[#00FF41]/50 truncate max-w-[100px]">{item.name}</span>
                    <span className="text-[#00FF41]/70">₹{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="mt-6 border border-[#00FF41]/15 p-5 bg-[#00FF41]/[0.01]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-[#00FF41]/40">[BAR]</span>
              <span className="text-xs text-[#00FF41]/70">CATEGORY_RANKING</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={grouped.slice(0, 10)} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,255,65,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#00FF41', fontSize: 9, opacity: 0.5 }}
                  axisLine={{ stroke: 'rgba(0,255,65,0.15)' }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: '#00FF41', fontSize: 9, opacity: 0.3 }}
                  axisLine={{ stroke: 'rgba(0,255,65,0.15)' }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0A0A0A',
                    border: '1px solid rgba(0,255,65,0.4)',
                    borderRadius: '0',
                    color: '#00FF41',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'TOTAL']}
                />
                <Bar dataKey="value" fill="#00FF41" opacity={0.6} radius={[2, 2, 0, 0]}>
                  {grouped.slice(0, 10).map((_, index) => (
                    <Cell key={index} fill="#00FF41" opacity={0.3 + (0.07 * (10 - index))} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Transaction Log */}
          <div className="mt-6 border border-[#00FF41]/15 bg-[#00FF41]/[0.01]">
            <div className="px-5 py-3 border-b border-[#00FF41]/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#00FF41]/40">[LOG]</span>
                <span className="text-xs text-[#00FF41]/70">TRANSACTION_HISTORY</span>
              </div>
              <span className="text-[10px] text-[#00FF41]/30">{data.length} ENTRIES</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 border-b border-[#00FF41]/10 text-[10px] text-[#00FF41]/30 uppercase">
                <span className="col-span-1">#</span>
                <span className="col-span-2">DATE</span>
                <span className="col-span-3">RECEIVER</span>
                <span className="col-span-3">CLASS</span>
                <span className="col-span-3 text-right">AMOUNT</span>
              </div>
              {data.map((tx, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 px-5 py-2 border-b border-[#00FF41]/[0.04] hover:bg-[#00FF41]/[0.03] transition-colors text-xs"
                >
                  <span className="col-span-1 text-[#00FF41]/20">{String(i).padStart(3, '0')}</span>
                  <span className="col-span-2 text-[#00FF41]/40">
                    {new Date(tx.Date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="col-span-3 text-[#00FF41]/70 truncate">{tx.Receiver}</span>
                  <span className="col-span-3 text-[#00FF41]/40 truncate">{tx.Classification}</span>
                  <span className="col-span-3 text-right text-[#00FF41]/90">₹{tx.Amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <span className="text-[10px] text-[#00FF41]/20">
              END OF REPORT • GENERATED AT {currentTime} • FINANCE_TERMINAL v2.6.0
            </span>
          </div>
        </main>
      </div>
    </div>
  )
}

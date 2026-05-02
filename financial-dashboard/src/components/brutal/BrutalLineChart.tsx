'use client'

import * as React from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from "recharts"
import { Transaction } from "@/types/Transaction"

export function BrutalLineChart({ data }: { data?: Transaction[] }) {
  const daily = React.useMemo(() => {
    if (!data || data.length === 0) return []

    const map: Record<string, number> = {}
    data.forEach((tx) => {
      const amt = parseFloat(tx.Amount.replace(/,/g, "")) || 0
      const date = new Date(tx.Date).toISOString().split("T")[0]
      map[date] = (map[date] || 0) + amt
    })

    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [data])

  return (
    <div className="brutal-border bg-white brutal-shadow">
      {/* Header */}
      <div className="bg-[#FF3366] text-white px-5 py-3 flex items-center justify-between border-b-4 border-black">
        <h2 className="font-black uppercase text-sm">DAILY SPEND TREND</h2>
        <span className="text-[10px] font-mono font-bold opacity-80">{daily.length} days</span>
      </div>

      {/* Chart */}
      <div className="p-5">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={daily} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <defs>
              <linearGradient id="brutalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF3366" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FF3366" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" stroke="#000" strokeOpacity={0.06} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#000', strokeWidth: 2 }}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#000' }}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#000', strokeWidth: 2 }}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#000' }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: '#000',
                border: '3px solid #FF3366',
                borderRadius: '0',
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
              labelFormatter={(v) =>
                new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
              }
              formatter={(value: number) => [`₹${value.toLocaleString()}`, 'SPENT']}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#FF3366"
              strokeWidth={3}
              fill="url(#brutalGrad)"
              dot={{ fill: '#FF3366', stroke: '#000', strokeWidth: 2, r: 4 }}
              activeDot={{ fill: '#FFEE00', stroke: '#000', strokeWidth: 3, r: 6 }}
            />
            {daily.length > 7 && (
              <Brush
                dataKey="date"
                height={30}
                stroke="#000"
                fill="#FFFDE6"
                travellerWidth={10}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

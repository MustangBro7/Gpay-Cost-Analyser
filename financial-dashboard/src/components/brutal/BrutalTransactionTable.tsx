'use client'

import * as React from "react"
import { Transaction } from "@/types/Transaction"
import { BrutalTransactionItem } from "./BrutalTransactionItem"

export function BrutalTransactionTable({
  data,
  refetch,
}: {
  data: Transaction[]
  refetch: () => void
}) {
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null)
  const [currentPage, setCurrentPage] = React.useState(0)
  const pageSize = 15
  const totalPages = Math.ceil(data.length / pageSize)
  const paginated = data.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div className="brutal-border bg-white brutal-shadow">
      {/* Header */}
      <div className="bg-black text-white px-5 py-3 flex items-center justify-between">
        <h2 className="font-black uppercase text-sm">ALL TRANSACTIONS</h2>
        <span className="text-[10px] font-mono text-[#FFEE00]">{data.length} records</span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-5 py-2 border-b-3 border-black bg-[#FFEE00] text-[10px] font-black uppercase tracking-wider">
        <span className="col-span-1">#</span>
        <span className="col-span-2">DATE</span>
        <span className="col-span-3">RECEIVER</span>
        <span className="col-span-3">CATEGORY</span>
        <span className="col-span-2 text-right">AMOUNT</span>
        <span className="col-span-1 text-center">⚡</span>
      </div>

      {/* Rows */}
      <div className="divide-y-2 divide-black/10 max-h-[500px] overflow-y-auto">
        {paginated.map((tx, i) => {
          const globalIdx = currentPage * pageSize + i
          const isExpanded = expandedIdx === globalIdx
          return (
            <div key={globalIdx}>
              <div
                className={`grid grid-cols-12 gap-2 px-5 py-3 cursor-pointer transition-colors ${
                  isExpanded ? "bg-[#FFEE00]/30" : "hover:bg-[#FFFDE6]"
                }`}
                onClick={() => setExpandedIdx(isExpanded ? null : globalIdx)}
              >
                <span className="col-span-1 text-xs font-mono font-bold text-black/30">
                  {String(globalIdx + 1).padStart(2, '0')}
                </span>
                <span className="col-span-2 text-xs font-mono font-bold text-black/60">
                  {new Date(tx.Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
                <span className="col-span-3 text-sm font-bold truncate">{tx.Receiver}</span>
                <span className="col-span-3">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-black bg-[#FFFDE6] inline-block truncate max-w-full">
                    {tx.Classification}
                  </span>
                </span>
                <span className="col-span-2 text-right font-black text-sm">₹{tx.Amount}</span>
                <span className="col-span-1 text-center text-xs">
                  {isExpanded ? "▼" : "▶"}
                </span>
              </div>
              {isExpanded && (
                <div className="px-5 py-3 bg-[#FFFDE6] border-t-2 border-black/10">
                  <BrutalTransactionItem tx={tx} refetch={refetch} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-5 py-3 border-t-3 border-black bg-[#F5F3E0]">
          <button
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
            className="text-xs font-black uppercase border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-[#FFEE00] transition-colors bg-white"
          >
            ← PREV
          </button>
          <span className="text-xs font-mono font-bold">
            PAGE {currentPage + 1} OF {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages - 1}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
            className="text-xs font-black uppercase border-2 border-black px-3 py-1.5 disabled:opacity-30 hover:bg-[#FFEE00] transition-colors bg-white"
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import * as React from "react"
import { Transaction } from "@/types/Transaction"

interface BrutalClassificationFilterProps {
  data: Transaction[]
  selectedClassifications: Set<string>
  onSelectionChange: (selected: Set<string>) => void
}

export function BrutalClassificationFilter({
  data,
  selectedClassifications,
  onSelectionChange,
}: BrutalClassificationFilterProps) {
  const availableClassifications = React.useMemo(() => {
    const unique = new Set<string>()
    data.forEach((tx) => unique.add(tx.Classification))
    return Array.from(unique).sort()
  }, [data])

  // Auto-select all classifications when data changes
  React.useEffect(() => {
    if (availableClassifications.length > 0) {
      const allSelected = new Set(availableClassifications)
      const currentStr = Array.from(selectedClassifications).sort().join(',')
      const allStr = Array.from(allSelected).sort().join(',')
      if (currentStr !== allStr) {
        onSelectionChange(allSelected)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableClassifications])

  const handleToggle = (classification: string) => {
    const newSelection = new Set(selectedClassifications)
    if (newSelection.has(classification)) {
      newSelection.delete(classification)
    } else {
      newSelection.add(classification)
    }
    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    onSelectionChange(new Set(availableClassifications))
  }

  const handleClearAll = () => {
    onSelectionChange(new Set())
  }

  const CHIP_COLORS = [
    "bg-[#FF3366]", "bg-[#00FF88]", "bg-[#FFEE00]", "bg-[#00CCFF]",
    "bg-[#FF6600]", "bg-[#CC00FF]", "bg-[#FF0000]", "bg-[#00FF00]",
    "bg-[#0066FF]", "bg-[#FF00FF]", "bg-[#FFAA00]", "bg-[#00FFCC]",
  ]

  return (
    <div className="brutal-border bg-white p-4 brutal-shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black uppercase tracking-wider">FILTER BY CATEGORY</h3>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-[10px] font-bold uppercase border-2 border-black px-2 py-0.5 hover:bg-[#00FF88] transition-colors"
          >
            ALL
          </button>
          <button
            onClick={handleClearAll}
            className="text-[10px] font-bold uppercase border-2 border-black px-2 py-0.5 hover:bg-[#FF3366] hover:text-white transition-colors"
          >
            NONE
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {availableClassifications.map((classification, i) => {
          const isSelected = selectedClassifications.has(classification)
          const colorClass = CHIP_COLORS[i % CHIP_COLORS.length]
          return (
            <button
              key={classification}
              onClick={() => handleToggle(classification)}
              className={`text-[11px] font-bold uppercase px-3 py-1.5 border-2 border-black transition-all ${
                isSelected
                  ? `${colorClass} text-black brutal-shadow-sm translate-x-0 translate-y-0`
                  : "bg-white text-black/40 line-through"
              }`}
            >
              {classification}
            </button>
          )
        })}
      </div>
    </div>
  )
}

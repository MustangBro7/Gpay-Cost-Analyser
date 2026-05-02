'use client'

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Transaction } from "@/types/Transaction"
import { CheckIcon, ChevronDown, ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"

interface ClassificationFilterProps {
  data: Transaction[]
  selectedClassifications: Set<string>
  onSelectionChange: (selected: Set<string>) => void
}

export function ClassificationFilter({
  data,
  selectedClassifications,
  onSelectionChange,
}: ClassificationFilterProps) {
  // Extract unique classifications from data
  const availableClassifications = React.useMemo(() => {
    const unique = new Set<string>()
    data.forEach((tx) => unique.add(tx.Classification))
    return Array.from(unique).sort()
  }, [data])

  // Auto-select all classifications when data changes
  React.useEffect(() => {
    if (availableClassifications.length > 0) {
      const allSelected = new Set(availableClassifications)
      // Only update if the sets are different
      const currentStr = Array.from(selectedClassifications).sort().join(',')
      const allStr = Array.from(allSelected).sort().join(',')
      if (currentStr !== allStr) {
        onSelectionChange(allSelected)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableClassifications]) // Only run when classifications change

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

  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-full justify-between rounded-xl border-border/70 bg-background/75 px-4 shadow-sm sm:w-[260px]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ListFilter className="size-4 text-muted-foreground" />
            <span className="truncate">
              {selectedClassifications.size === 0
                ? "No filters"
                : selectedClassifications.size === availableClassifications.length
                ? "All classifications"
                : `${selectedClassifications.size} selected`}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] overflow-hidden rounded-2xl border-border/70 bg-popover/95 p-0 shadow-2xl backdrop-blur"
        align="start"
      >
        <div className="max-h-[400px] overflow-y-auto">
          <div className="sticky top-0 flex items-center justify-between border-b border-border/70 bg-background/95 px-3 py-2 backdrop-blur">
            <span className="text-sm font-semibold">Classifications</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-primary hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-primary hover:underline"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="p-2">
            {availableClassifications.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No classifications available
              </div>
            ) : (
              availableClassifications.map((classification) => {
                const isSelected = selectedClassifications.has(classification)
                return (
                  <div
                    key={classification}
                    className="flex cursor-pointer items-center space-x-2 rounded-xl px-3 py-2 transition-colors hover:bg-accent"
                    onClick={() => handleToggle(classification)}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center border rounded-sm",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {isSelected && (
                        <CheckIcon className="h-3 w-3" />
                      )}
                    </div>
                    <label
                      className="flex-1 text-sm cursor-pointer"
                      onClick={(e) => e.preventDefault()}
                    >
                      {classification}
                    </label>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

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
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface GroupFilterProps {
  options: string[]
  /** Selection applied whenever the available options change. Defaults to every option. */
  defaultSelection?: string[]
  selected: Set<string>
  onSelectionChange: (selected: Set<string>) => void
  title: string
  allLabel: string
  emptyLabel: string
  icon?: LucideIcon
  formatOption?: (option: string) => string
  /** When false, the parent owns resetting the selection. */
  autoReset?: boolean
}

export function GroupFilter({
  options,
  defaultSelection,
  selected,
  onSelectionChange,
  title,
  allLabel,
  emptyLabel,
  icon: Icon = ListFilter,
  formatOption = (option) => option,
  autoReset = true,
}: GroupFilterProps) {
  const defaults = defaultSelection ?? options

  // Reset the selection when the available options change
  React.useEffect(() => {
    if (autoReset && options.length > 0) {
      const currentStr = Array.from(selected).sort().join(',')
      const defaultStr = [...defaults].sort().join(',')
      if (currentStr !== defaultStr) {
        onSelectionChange(new Set(defaults))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]) // Only run when options change

  const handleToggle = (option: string) => {
    const newSelection = new Set(selected)
    if (newSelection.has(option)) {
      newSelection.delete(option)
    } else {
      newSelection.add(option)
    }
    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    onSelectionChange(new Set(options))
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
            <Icon className="size-4 text-muted-foreground" />
            <span className="truncate">
              {selected.size === 0
                ? "No filters"
                : selected.size === options.length ||
                  (selected.size === defaults.length && defaults.every((option) => selected.has(option)))
                ? allLabel
                : `${selected.size} selected`}
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
            <span className="text-sm font-semibold">{title}</span>
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
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {emptyLabel}
              </div>
            ) : (
              options.map((option) => {
                const isSelected = selected.has(option)
                return (
                  <div
                    key={option}
                    className="flex cursor-pointer items-center space-x-2 rounded-xl px-3 py-2 transition-colors hover:bg-accent"
                    onClick={() => handleToggle(option)}
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
                      {formatOption(option)}
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

  return (
    <GroupFilter
      options={availableClassifications}
      selected={selectedClassifications}
      onSelectionChange={onSelectionChange}
      title="Classifications"
      allLabel="All classifications"
      emptyLabel="No classifications available"
    />
  )
}

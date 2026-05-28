"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ClassificationInputProps {
  categories: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function ClassificationInput({
  categories,
  value,
  onChange,
  placeholder = "Type or select a category...",
  className,
}: ClassificationInputProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const filteredCategories = React.useMemo(() => {
    if (!value.trim()) {
      return categories
    }

    const search = value.toLowerCase()
    return categories.filter((category) => category.toLowerCase().includes(search))
  }, [categories, value])

  const isCustomValue = React.useMemo(() => {
    if (!value.trim()) {
      return false
    }

    return !categories.some((category) => category.toLowerCase() === value.toLowerCase())
  }, [categories, value])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectCategory = React.useCallback((category: string) => {
    onChange(category)
    setIsOpen(false)
  }, [onChange])

  return (
    <div className={cn("relative space-y-1.5", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="h-12 px-4 pr-10 text-base"
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronsUpDown className="h-5 w-5" />
        </button>
      </div>

      {isOpen ? (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-border/70 bg-popover p-1.5 shadow-lg"
        >
          {isCustomValue && value.trim() ? (
            <button
              type="button"
              onClick={() => selectCategory(value.trim())}
              className="relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              <span className="mr-2 text-muted-foreground">+</span>
              Create &quot;{value.trim()}&quot;
            </button>
          ) : null}

          {filteredCategories.length > 0 ? (
            filteredCategories.map((category) => {
              const isSelected = value.trim().toLowerCase() === category.toLowerCase()

              return (
                <button
                  type="button"
                  key={category}
                  onClick={() => selectCategory(category)}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2.5 h-4 w-4",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {category}
                </button>
              )
            })
          ) : !isCustomValue ? (
            <div className="px-3 py-2.5 text-center text-sm text-muted-foreground">
              No categories found
            </div>
          ) : null}
        </div>
      ) : null}

      {value && isCustomValue ? (
        <p className="text-xs text-muted-foreground">
          Press Enter or click to add a custom category.
        </p>
      ) : null}
    </div>
  )
}

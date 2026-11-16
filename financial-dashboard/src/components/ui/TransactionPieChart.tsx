'use client'

import * as React from "react"
import { Cell, Label, Pie, PieChart } from "recharts"
import { ChevronDown, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { buildGroupColors, type GroupColorFn } from "@/lib/chartColors"
import { formatGroupLabel, getGroupKeys, hasOverlappingTags, parseAmount } from "@/lib/tags"
import { useDoubleTap, useIsTouchDevice } from "@/hooks/useDoubleTap"
import { GroupBy } from "@/types/Tag"
import { Transaction } from "@/types/Transaction"

/** Legend rows shown before "Show more"; the chart itself always draws every slice. */
const COLLAPSED_LEGEND_ROWS = 6

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function PieChartComponent({
  data,
  activeClassification,
  onClassificationSelect,
  onResetFocus,
  isFiltered = false,
  groupBy = "classification",
  colorFor,
}: {
  data: Transaction[]
  activeClassification?: string | null
  onClassificationSelect: (classification: string) => void
  /** Returns the dashboard to every group. Enables "Show all" and double-tap on touch screens. */
  onResetFocus?: () => void
  /** True when the dashboard is narrowed to some groups (one or several). */
  isFiltered?: boolean
  /** Bucket slices by classification (default) or by tag. */
  groupBy?: GroupBy
  /** Stable per-group colors shared with the other widgets. */
  colorFor?: GroupColorFn
}) {
  const isTouch = useIsTouchDevice()
  const [isLegendExpanded, setIsLegendExpanded] = React.useState(false)

  const safeData = React.useMemo(
    () => (Array.isArray(data) ? data : []),
    [data]
  )

  // Largest first, so slices run clockwise from 12 o'clock and the legend reads as a ranking.
  const slices = React.useMemo(() => {
    const grouped = new Map<string, number>()
    safeData.forEach((curr) => {
      const amount = parseAmount(curr.Amount)
      getGroupKeys(curr, groupBy).forEach((key) => {
        grouped.set(key, (grouped.get(key) ?? 0) + amount)
      })
    })

    const sorted = Array.from(grouped.entries())
      .map(([classification, amount]) => ({ classification, amount }))
      .sort(
        (a, b) =>
          b.amount - a.amount ||
          formatGroupLabel(a.classification).localeCompare(formatGroupLabel(b.classification))
      )

    const getColor = colorFor ?? buildGroupColors(sorted.map((entry) => entry.classification))
    return sorted.map((entry) => ({ ...entry, fill: getColor(entry.classification) }))
  }, [colorFor, groupBy, safeData])

  // A transaction with several tags counts toward each of them, so the centre total and the
  // percentages use the real (de-duplicated) spend rather than the sum of slices.
  const isTagView = groupBy === "tag"
  const total = isTagView
    ? safeData.reduce((acc, curr) => acc + parseAmount(curr.Amount), 0)
    : slices.reduce((acc, curr) => acc + curr.amount, 0)
  const showsOverlap = isTagView && hasOverlappingTags(safeData)

  const chartConfig = React.useMemo(
    () =>
      Object.fromEntries(
        slices.map((entry) => [
          entry.classification,
          { label: formatGroupLabel(entry.classification), color: entry.fill },
        ])
      ),
    [slices]
  )

  const hasActiveClassification = Boolean(activeClassification)
  const canReset = Boolean(onResetFocus) && isFiltered
  const groupNoun = isTagView ? "tag" : "category"

  const handleReset = React.useCallback(() => {
    onResetFocus?.()
  }, [onResetFocus])

  const doubleTap = useDoubleTap(handleReset, canReset)

  const handleSliceSelect = (classification: string) => {
    if (activeClassification === classification) {
      // On touch the second half of a double tap lands on the focused slice; leave the
      // reset to the double tap rather than toggling on the first tap.
      if (isTouch) return
    }
    onClassificationSelect(classification)
  }

  const handleLegendSelect = (classification: string) => {
    // Tapping the focused row again is the easy way back on a phone.
    if (activeClassification === classification && canReset) {
      handleReset()
      return
    }
    onClassificationSelect(classification)
  }

  const hasHiddenRows = slices.length > COLLAPSED_LEGEND_ROWS
  const legendRows = hasHiddenRows && !isLegendExpanded
    ? slices.slice(0, COLLAPSED_LEGEND_ROWS)
    : slices
  const centerLabel = activeClassification
    ? formatGroupLabel(activeClassification)
    : isTagView
      ? "Tagged Spend"
      : "Total Spend"

  const description = canReset
    ? isTouch
      ? `Double-tap the chart to see every ${groupNoun} again.`
      : `Showing part of your spending. Use Show all to see every ${groupNoun}.`
    : isTouch
      ? `Tap a slice or ${groupNoun} to focus the dashboard.`
      : `Click a slice or ${groupNoun} to focus the dashboard.`

  return (
    <Card className="flex h-full flex-col rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>{isTagView ? "Spending by Tag" : "Spending by Classification"}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {canReset ? (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3"
              onClick={handleReset}
            >
              <Undo2 className="size-3.5" />
              Show all
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="flex-1 px-2 pb-2 sm:px-6">
        <div
          {...doubleTap}
          className="touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
        >
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[19rem]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={slices}
                dataKey="amount"
                nameKey="classification"
                innerRadius="58%"
                outerRadius="85%"
                startAngle={90}
                endAngle={-270}
                stroke="var(--background)"
                strokeWidth={6}
                onClick={(_, index) => {
                  const item = slices[index]
                  if (!item) return
                  handleSliceSelect(item.classification)
                }}
              >
                {slices.map((entry) => {
                  const isActive = activeClassification === entry.classification
                  return (
                    <Cell
                      key={entry.classification}
                      fill={entry.fill}
                      className="cursor-pointer outline-none"
                      fillOpacity={hasActiveClassification && !isActive ? 0.4 : 1}
                      strokeOpacity={hasActiveClassification && !isActive ? 0.55 : 1}
                    />
                  )
                })}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {formatCurrency(total)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 22}
                            className="fill-muted-foreground text-xs"
                          >
                            {centerLabel.length > 18 ? `${centerLabel.slice(0, 17)}…` : centerLabel}
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch gap-2 border-t border-border/70 pt-4">
        <ol className="flex w-full flex-col gap-0.5">
          {legendRows.map((entry) => {
            const isActive = activeClassification === entry.classification
            const isDimmed = hasActiveClassification && !isActive
            const share = total > 0 ? Math.round((entry.amount / total) * 100) : 0
            return (
              <li key={entry.classification} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleLegendSelect(entry.classification)}
                  className={cn(
                    "flex min-h-10 w-full min-w-0 items-center gap-2.5 rounded-full px-2 text-left text-sm outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-8",
                    isActive && "bg-muted/60",
                    isDimmed && "opacity-50"
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="min-w-0 flex-1 truncate">{formatGroupLabel(entry.classification)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCurrency(entry.amount)}
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {share}%
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        {hasHiddenRows ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 self-center rounded-full px-3 text-muted-foreground"
            onClick={() => setIsLegendExpanded((expanded) => !expanded)}
          >
            <ChevronDown className={cn("size-4 transition-transform", isLegendExpanded && "rotate-180")} />
            {isLegendExpanded
              ? "Show fewer"
              : `Show ${slices.length - COLLAPSED_LEGEND_ROWS} more`}
          </Button>
        ) : null}
        {showsOverlap ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Some transactions have more than one tag, so they count toward each tag and shares
            can add up to more than 100%.
          </p>
        ) : null}
      </CardFooter>
    </Card>
  )
}

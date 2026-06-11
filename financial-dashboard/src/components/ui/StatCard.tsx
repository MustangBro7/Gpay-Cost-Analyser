import * as React from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface StatTrend {
  /** Signed percentage change, e.g. 12.4 or -8.1. */
  percent: number
  /** Short context, e.g. "vs previous period". */
  label: string
  /** Controls the chip color; spend increases are usually "negative". */
  sentiment: "positive" | "negative" | "neutral"
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  trend?: StatTrend
  className?: string
}

const TREND_STYLES: Record<StatTrend["sentiment"], string> = {
  positive: "border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  negative: "border-rose-500/20 bg-rose-500/12 text-rose-700 dark:text-rose-300",
  neutral: "border-border bg-muted/60 text-muted-foreground",
}

export function TrendChip({ trend, className }: { trend: StatTrend; className?: string }) {
  const Arrow = trend.percent >= 0 ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TREND_STYLES[trend.sentiment],
        className
      )}
    >
      <Arrow className="size-3" aria-hidden />
      {trend.percent >= 0 ? "+" : ""}
      {trend.percent.toFixed(1)}% {trend.label}
    </span>
  )
}

export function StatCard({ icon: Icon, label, value, hint, trend, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "gap-3 rounded-[1.75rem] border-border/70 bg-card/90 py-5 shadow-sm",
        className
      )}
    >
      <CardHeader className="gap-2.5 px-4 sm:px-6">
        <CardDescription className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 truncate">{label}</span>
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {value}
          </CardTitle>
          {trend ? <TrendChip trend={trend} /> : null}
        </div>
      </CardHeader>
      {hint ? (
        <CardContent className="hidden px-4 pt-0 text-sm text-muted-foreground sm:px-6 md:block">
          {hint}
        </CardContent>
      ) : null}
    </Card>
  )
}

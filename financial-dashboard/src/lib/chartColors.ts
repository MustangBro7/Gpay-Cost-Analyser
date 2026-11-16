import { UNTAGGED_KEY } from "@/lib/tags"

/** Number of `--chart-N` tokens defined in globals.css. */
export const CHART_PALETTE_SIZE = 16

/** Color for groups that aren't a real entity ("Untagged", "Other tags", "N more"). */
export const NEUTRAL_CHART_COLOR = "var(--muted-foreground)"

export type GroupColorFn = (key: string) => string

// Past the palette, blend two palette colors so every group still gets its own color.
// Pairs far apart in the palette come first, so the blends stay distinct from their parents.
const BLEND_PAIRS: Array<[number, number]> = (() => {
  const pairs: Array<[number, number]> = []
  const seen = new Set<string>()
  for (let offset = CHART_PALETTE_SIZE / 2; offset >= 1; offset -= 1) {
    for (let start = 1; start <= CHART_PALETTE_SIZE; start += 1) {
      const end = ((start - 1 + offset) % CHART_PALETTE_SIZE) + 1
      const id = [start, end].sort((a, b) => a - b).join("-")
      if (seen.has(id)) continue
      seen.add(id)
      pairs.push([start, end])
    }
  }
  return pairs
})()

/** The nth categorical color. Unique for any index; theme-aware because it only uses tokens. */
export function chartColor(index: number): string {
  if (index < CHART_PALETTE_SIZE) {
    return `var(--chart-${index + 1})`
  }
  const extra = index - CHART_PALETTE_SIZE
  const [a, b] = BLEND_PAIRS[extra % BLEND_PAIRS.length]
  // Shift the blend ratio on every pass through the pair list so the output never repeats.
  const pass = Math.floor(extra / BLEND_PAIRS.length)
  const weight = 50 + ((pass * 17) % 40) - 20
  return `color-mix(in oklch, var(--chart-${a}) ${weight}%, var(--chart-${b}))`
}

/**
 * Gives every group a unique color that follows the group, not its rank, so filtering
 * or reclassifying never repaints the groups that are still on screen.
 * `orderedKeys` decides who gets the earlier (most distinct) palette slots.
 */
export function buildGroupColors(orderedKeys: string[]): GroupColorFn {
  const colors = new Map<string, string>()
  orderedKeys.forEach((key) => {
    const normalized = key.trim().toLowerCase()
    if (key === UNTAGGED_KEY || colors.has(normalized)) return
    colors.set(normalized, chartColor(colors.size))
  })

  return (key: string) => {
    if (key === UNTAGGED_KEY) return NEUTRAL_CHART_COLOR
    const normalized = key.trim().toLowerCase()
    const existing = colors.get(normalized)
    if (existing) return existing
    // Unknown keys are appended, so they still never share a color.
    const color = chartColor(colors.size)
    colors.set(normalized, color)
    return color
  }
}

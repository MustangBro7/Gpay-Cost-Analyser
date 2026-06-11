# Financial Dashboard — UI Design System

All UI in this app follows one visual language ("mist & teal"). Any new page, component,
or dialog must follow these rules. Do not introduce new visual styles.

## Routing & SEO
- `/` is the public, SEO-optimized landing page. It is always reachable (even signed in) and
  must stay a **server component** (`src/components/LandingPage.tsx` has no `'use client'`).
  Its metadata + JSON-LD live in `src/app/page.tsx`; `robots.ts` and `sitemap.ts` exist too.
- `/dashboard` is the signed-in app. Auth-aware CTAs use `SmartCta` (`src/components/SmartCta.tsx`):
  signed-out → Google flow landing on `/dashboard`, signed-in → link to `/dashboard`.
- `GoogleSignInButton` takes `redirectUrlComplete` (default `/dashboard`); pass the current page
  for non-dashboard sign-ins (e.g. `/admin/evals`).
- New app pages go under `/dashboard/...` or `/admin/...` and get disallowed in `robots.ts`.

## Stack
- Next.js App Router + Tailwind v4 + shadcn components (`src/components/ui`).
- Theme tokens live in `src/app/globals.css` as oklch CSS variables (light + `.dark`).
- Icons: `lucide-react` only. Fonts: Inter (`font-sans`), Geist Mono for code/IDs.

## Color
- Use semantic tokens only: `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary`, `bg-muted`,
  `text-destructive`, `var(--chart-1..5)`. Never hardcode hex/oklch values in components.
- Primary is teal (oklch hue ~186). Use it for primary actions, icon chips, and emphasis;
  surfaces and text stay in the mist-gray ramp.
- Charts use the 5-color data palette (`--chart-1..5`: teal, blue, amber, violet, rose).
  `--chart-1` (teal) is the anchor for single-series charts; multi-series cycle through 1–5.
- Status/category tints are the one exception: translucent Tailwind tints in the pattern
  `border-{color}-500/20 bg-{color}-500/12 text-{color}-700 dark:text-{color}-300`
  (see `TransactionTable.tsx` and `statusBadgeClass` in `admin/evals/page.tsx`).
  Success = emerald, error = destructive token, neutral/skipped = muted.
- Dark mode is automatic via tokens — never write `dark:` overrides for surface colors,
  only for the status-tint text shades above.

## Shape language
- Page-level containers, headers, and feature cards: `rounded-[1.75rem]` (or `rounded-[2rem]`
  for hero surfaces). Inner panels inside a card: `rounded-2xl` or `rounded-[1.25rem]`.
- Buttons, badges, filter chips, and toggles are pills: `rounded-full`
  (standard heights: `h-10`/`h-11`, padding `px-4`/`px-5`). Primary CTAs may use `rounded-xl`.
- Borders are soft: `border-border/70` (or `/60` for nested panels).

## Surfaces & depth
- Cards: `border-border/70 bg-card/90 shadow-sm`. Translucent page headers / hero surfaces:
  `bg-background/75-80` + `backdrop-blur` + `shadow-sm` (hero login/marketing: `shadow-xl`).
- Nested info tiles inside a card: `border border-border/60 bg-muted/20` (or `bg-background/85`).
- Background gradient washes are defined once on `body` in `globals.css`; for extra glow use a
  single absolutely-positioned `bg-primary/10 blur-3xl` blob (see `LandingPage.tsx`).

## Responsive layout rules (mobile overflow prevention)
- Every `grid` must declare a base column template (`grid-cols-1`), not just breakpoint
  variants — an implicit `auto` track sizes to children's min-content, and recharts SVGs /
  `truncate` text will blow it past the viewport and lock the page in horizontal overflow.
- Arbitrary fr templates must clamp the minimum: `grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]`,
  never bare `[1.05fr_0.95fr]` (fr's implicit minimum is min-content, not 0).
- `truncate` only works on flex items that also have `min-w-0`; columns/wrappers holding
  charts need `min-w-0` too.
- Charts: prefer percentage radii (`innerRadius="58%"`) and responsive containers over fixed
  pixel geometry — fixed radii break when the container is small.
- Verify new layouts at a 390px viewport: `document.documentElement.scrollWidth` must equal
  the viewport width.

## Typography
- Page titles: `text-3xl sm:text-4xl font-semibold tracking-tight`.
- Card titles: `text-lg`–`text-xl font-semibold tracking-tight`. Stat values: `text-2xl`–`text-3xl`.
- Micro-labels (above metadata): `text-xs uppercase tracking-[0.2em] text-muted-foreground`.
- Body/supporting copy: `text-sm leading-6 text-muted-foreground` (hero: `text-base leading-7`).
- Currency is INR, formatted with `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })`.

## Reusable patterns (use these, don't reinvent)
- `StatCard` (`src/components/ui/StatCard.tsx`) for any metric tile: icon chip + label +
  value + optional hint + optional `trend` (period-over-period `TrendChip`). Icon chips
  everywhere are `flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary`.
- Hero metric: one solid `bg-primary text-primary-foreground` card per page max, with soft
  `bg-primary-foreground/10 blur-2xl` blobs for depth (see Total Spend on `/dashboard`).
- App pages use the sticky glass top bar: `sticky top-0 z-40 border-b border-border/60
  bg-background/75 backdrop-blur-xl` with logo linking to `/`.
- `LandingPage` (`src/components/LandingPage.tsx`) is the public marketing page for `/`.
- `ThemeToggle` goes in the top-right of every page. `GoogleSignInButton` is the only sign-in entry.
- Stat rows: never horizontal scroll — all KPIs must be visible at once. Use
  `grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4` with the hero card on `col-span-2`
  and compact stat cards filling single cells (hints stay `hidden md:block`).
- Charts area: 12-col grid on `xl` (`grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-12`),
  each cell wrapped in `min-w-0` with spans like 8/4 and 7/5; cards inside use
  `h-full` (+ `flex flex-col` with `mt-auto` footers) so rows stay flush.
- Empty states: dashed-border card, centered icon chip, short title + description, one action.
- Charts use `ChartContainer` from `src/components/ui/chart.tsx` with `var(--chart-*)` colors only.
- Loading states: lucide `Loader2`/`LoaderCircle` with `animate-spin`; refresh icons spin while busy.

## Voice
- Copy is concrete and product-specific (transactions, categories, date ranges) — never
  reference the theme, framework, or design system in user-facing text.
- Sentence case for labels and buttons ("Add transaction", "Apply search").

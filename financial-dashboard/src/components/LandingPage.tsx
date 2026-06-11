import * as React from "react"
import Image from "next/image"
import {
  CalendarRange,
  ChartPie,
  Layers3,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SmartCta } from "@/components/SmartCta"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const PREVIEW_CATEGORIES = [
  { label: "Food & Dining", amount: "₹8,420", width: "w-[92%]" },
  { label: "Transfers", amount: "₹5,150", width: "w-[62%]" },
  { label: "Groceries", amount: "₹3,890", width: "w-[47%]" },
  { label: "Travel", amount: "₹2,310", width: "w-[28%]" },
]

const FEATURES = [
  {
    icon: Mail,
    title: "Automatic Gmail import",
    description:
      "Google Pay receipts in your inbox become transactions on the dashboard — no manual entry, no bank exports.",
  },
  {
    icon: Sparkles,
    title: "AI-powered classification",
    description:
      "Every transaction is categorized by Gemini using rules you control, so 'Swiggy' lands in Food, not Other.",
  },
  {
    icon: CalendarRange,
    title: "Date-range analytics",
    description:
      "Slice spending by day, week, or month, drill into a category, and reclassify anything that looks off.",
  },
]

const STEPS = [
  {
    step: "01",
    title: "Sign in with Google",
    description: "One click connects your account with read-only access to Google Pay receipts.",
  },
  {
    step: "02",
    title: "Transactions sync & classify",
    description: "Receipts are parsed and categorized automatically using your own classification rules.",
  },
  {
    step: "03",
    title: "Explore your spending",
    description: "Charts, rankings, and a searchable table show exactly where the money went.",
  },
]

function PreviewBar({
  label,
  amount,
  width,
  emphasized,
}: {
  label: string
  amount: string
  width: string
  emphasized?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{amount}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn(
            "h-2 rounded-full",
            width,
            emphasized ? "bg-primary" : "bg-primary/45"
          )}
        />
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <header>
          <nav
            aria-label="Main navigation"
            className="flex items-center justify-between gap-3 py-5"
          >
            <div className="flex items-center gap-3">
              <Image
                src="/app-logo.png"
                alt="GPay Cost Analyzer logo"
                width={40}
                height={40}
                priority
                className="rounded-full shadow-sm ring-1 ring-border/70"
              />
              <span className="text-sm font-semibold tracking-tight sm:text-base">
                GPay Cost Analyzer
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <SmartCta compact />
            </div>
          </nav>
        </header>

        <main>
          <section
            aria-label="Introduction"
            className="grid grid-cols-1 items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14"
          >
            <div className="space-y-6">
              <Badge variant="outline" className="h-auto rounded-full px-3 py-1">
                <Sparkles className="size-3.5" />
                Gmail-powered · AI classified
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
                Know exactly where your{" "}
                <span className="text-primary">Google Pay</span> money goes.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                GPay Cost Analyzer turns the payment receipts already sitting in your Gmail into a
                clean spending dashboard — auto-imported, AI-categorized, and searchable by any
                date range.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <SmartCta />
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Read-only Gmail access. Your data stays scoped to your account.
              </p>
            </div>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/90 shadow-xl backdrop-blur">
              <CardHeader className="gap-1 border-b border-border/60 pb-5">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="size-4" />
                  This month
                </CardDescription>
                <div className="flex items-end justify-between gap-3">
                  <CardTitle className="text-3xl font-semibold tracking-tight">₹19,770</CardTitle>
                  <Badge variant="outline" className="h-auto rounded-full px-2.5 py-0.5 text-primary">
                    <TrendingUp className="size-3" />
                    47 transactions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3.5">
                  {PREVIEW_CATEGORIES.map((category, index) => (
                    <PreviewBar key={category.label} {...category} emphasized={index === 0} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Layers3 className="size-3.5" />
                      Top category
                    </p>
                    <p className="mt-1.5 truncate text-sm font-semibold">Food & Dining</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ChartPie className="size-3.5" />
                      Categories
                    </p>
                    <p className="mt-1.5 text-sm font-semibold">9 tracked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="features-heading" className="space-y-6 py-10 sm:py-14">
            <div className="space-y-2">
              <Badge variant="outline" className="h-auto w-fit rounded-full px-3 py-1">
                Features
              </Badge>
              <h2 id="features-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Built for effortless spend tracking.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card
                  key={feature.title}
                  className="gap-4 rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm"
                >
                  <CardHeader className="gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <feature.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="font-heading text-lg font-semibold tracking-tight">
                      {feature.title}
                    </h3>
                    <CardDescription className="leading-6">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="how-it-works-heading" className="py-10 sm:py-14">
            <Card className="rounded-[1.75rem] border-border/70 bg-background/75 shadow-sm backdrop-blur">
              <CardHeader className="gap-2">
                <Badge variant="outline" className="h-auto w-fit rounded-full px-3 py-1">
                  How it works
                </Badge>
                <h2
                  id="how-it-works-heading"
                  className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  From inbox to insight in three steps.
                </h2>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {STEPS.map((item) => (
                  <div key={item.step} className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
                      Step {item.step}
                    </p>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section aria-label="Get started" className="pb-10 sm:pb-14">
            <Card className="rounded-[1.75rem] border-border/70 bg-primary/8 shadow-sm">
              <CardContent className="flex flex-col items-start gap-5 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                    Ready to see where it all went?
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Sign in with Google and your dashboard builds itself from your existing receipts.
                  </p>
                </div>
                <SmartCta />
              </CardContent>
            </Card>
          </section>
        </main>

        <footer className="mt-auto flex flex-col items-start justify-between gap-2 border-t border-border/60 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span>GPay Cost Analyzer</span>
          <span>Track, classify, and analyze Google Pay spending.</span>
        </footer>
      </div>
    </div>
  )
}

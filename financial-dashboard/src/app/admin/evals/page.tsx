'use client'

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Database,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { AppSignedIn, AppSignedOut, useAppUser } from "@/lib/auth"
import { useAuthedFetch } from "@/lib/useAuthedFetch"
import { isLocalDevMockMode } from "@/lib/devMode"
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AdminAiEval, AdminAiEvalListResponse, AiEvalStatus } from "@/types/AdminAiEval"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Unavailable"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return format(parsed, "MMM d, yyyy HH:mm:ss")
}

function formatLatency(value: number | null) {
  if (value == null) {
    return "n/a"
  }

  return `${value} ms`
}

function formatJsonBlock(value: string | null) {
  if (!value) {
    return "Unavailable"
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function statusTone(status: AiEvalStatus) {
  if (status === "success") {
    return "default"
  }
  if (status === "error") {
    return "destructive"
  }
  return "secondary"
}

function statusLabel(status: AiEvalStatus) {
  if (status === "success") {
    return "Model ok"
  }
  if (status === "error") {
    return "Model error"
  }
  return "Skipped"
}

function SnippetPanel({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <section className={cn("rounded-[1.5rem] border border-border/70 bg-background/75 p-4 shadow-sm", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      </div>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-[1.1rem] bg-muted/60 p-4 font-mono text-xs leading-6 text-foreground">
        {value}
      </pre>
    </section>
  )
}

export default function AdminEvalsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const authedFetch = useAuthedFetch()
  const { user } = useAppUser()
  const [items, setItems] = React.useState<AdminAiEval[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<AiEvalStatus | "all">("all")
  const [queryInput, setQueryInput] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isForbidden, setIsForbidden] = React.useState(false)
  const [seedMessage, setSeedMessage] = React.useState<string | null>(null)
  const [isSeeding, setIsSeeding] = React.useState(false)

  const selectedTrace = React.useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  )

  const pageSummary = React.useMemo(() => {
    const errorCount = items.filter((item) => item.status === "error").length
    const successCount = items.filter((item) => item.status === "success").length
    const uniqueUsers = new Set(items.map((item) => item.clerk_user_id)).size

    return { errorCount, successCount, uniqueUsers }
  }, [items])

  const fetchPage = React.useCallback(async (showRefreshState = false) => {
    if (!apiUrl) {
      setError("NEXT_PUBLIC_API_URL is not configured.")
      setIsLoading(false)
      return
    }

    if (showRefreshState) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (status !== "all") {
        params.set("status", status)
      }
      if (query.trim()) {
        params.set("query", query.trim())
      }

      const response = await authedFetch(`${apiUrl}/admin/ai-evals?${params.toString()}`)
      if (response.status === 403) {
        setIsForbidden(true)
        setItems([])
        setTotal(0)
        setHasMore(false)
        setError(null)
        return
      }
      if (!response.ok) {
        throw new Error(`Failed to load AI evals: ${response.status}`)
      }

      const payload = (await response.json()) as AdminAiEvalListResponse
      setItems(payload.items)
      setTotal(payload.pagination.total)
      setHasMore(payload.pagination.has_more)
      setIsForbidden(false)
      setError(null)
      setSelectedId((current) =>
        payload.items.some((item) => item.id === current) ? current : (payload.items[0]?.id ?? null)
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unknown error")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [apiUrl, authedFetch, offset, query, status])

  React.useEffect(() => {
    fetchPage().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Unknown error")
      setIsLoading(false)
      setIsRefreshing(false)
    })
  }, [fetchPage])

  const handleSearchSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setOffset(0)
      setQuery(queryInput)
    },
    [queryInput]
  )

  const handleSeedLocalData = React.useCallback(async () => {
    if (!apiUrl) {
      setError("NEXT_PUBLIC_API_URL is not configured.")
      return
    }

    setIsSeeding(true)
    setSeedMessage(null)
    try {
      const response = await authedFetch(`${apiUrl}/admin/dev/seed-ai-evals`, {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error(`Failed to seed local traces: ${response.status}`)
      }

      const payload = (await response.json()) as { created: number; message: string }
      setSeedMessage(`${payload.message} Added ${payload.created} traces.`)
      await fetchPage(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unknown error")
    } finally {
      setIsSeeding(false)
    }
  }, [apiUrl, authedFetch, fetchPage])

  return (
    <>
      <AppSignedOut>
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <Card className="w-full max-w-2xl rounded-[2rem] border-border/70 bg-background/80 shadow-xl backdrop-blur">
              <CardHeader className="space-y-4">
                <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
                  Admin AI Eval Console
                </Badge>
                <CardTitle className="text-3xl font-semibold tracking-tight">
                  Sign in to inspect model prompts and outputs.
                </CardTitle>
                <CardDescription className="max-w-xl text-base leading-7">
                  This page is restricted to administrator accounts and exposes full prompt and output history across all users.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <GoogleSignInButton />
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/">
                    <ArrowLeft className="size-4" />
                    Back to dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </AppSignedOut>

      <AppSignedIn>
        <main className="mx-auto flex min-h-screen w-full max-w-[94rem] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
          <header className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/80 shadow-sm backdrop-blur">
            <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full px-3 py-1">
                    <BrainCircuit className="size-3.5" />
                    AI agent audit trail
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    Admin only
                  </Badge>
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                    Every Gemini prompt, output, fallback, and failure in one review surface.
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                    Use this page to audit extraction behavior across all users, isolate parse failures, and inspect the exact prompt that was sent for any transaction classification run.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.75rem] border border-border/70 bg-muted/35 p-4 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-[1.25rem] border border-border/60 bg-background/85 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Signed in</p>
                  <p className="mt-2 truncate text-sm font-medium">{user?.primaryEmailAddress?.emailAddress ?? "Unknown user"}</p>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-background/85 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Visible traces</p>
                  <p className="mt-2 text-2xl font-semibold">{total}</p>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-[1.25rem] border border-border/60 bg-background/85 p-4">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/">
                      <ArrowLeft className="size-4" />
                      Dashboard
                    </Link>
                  </Button>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </header>

          {isForbidden ? (
            <Card className="rounded-[1.75rem] border-destructive/35 bg-destructive/5 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <ShieldAlert className="size-5 text-destructive" />
                  <CardTitle className="text-xl">Access denied</CardTitle>
                </div>
                <CardDescription className="text-base leading-7">
                  Your account is signed in, but it does not have the `admin` role in D1. Promote the account in the `users` table or include its email in the backend `ADMIN_EMAILS` allowlist.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardDescription>Successes on this page</CardDescription>
                    <CardTitle className="text-3xl">{pageSummary.successCount}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardDescription>Errors on this page</CardDescription>
                    <CardTitle className="text-3xl">{pageSummary.errorCount}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="rounded-[1.75rem] border-border/70 bg-card/90 shadow-sm">
                  <CardHeader>
                    <CardDescription>Users represented</CardDescription>
                    <CardTitle className="text-3xl">{pageSummary.uniqueUsers}</CardTitle>
                  </CardHeader>
                </Card>
              </section>

              <Card className="rounded-[1.75rem] border-border/70 bg-background/80 shadow-sm">
                <CardContent className="grid gap-3 p-4 sm:p-6 lg:grid-cols-[1fr_auto_auto]">
                  <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={queryInput}
                        onChange={(event) => setQueryInput(event.target.value)}
                        placeholder="Search by user, prompt, output, or error"
                        className="h-11 rounded-full border-border/70 bg-background/75 pl-9"
                      />
                    </div>
                    <Button type="submit" className="h-11 rounded-full px-5">
                      Apply search
                    </Button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    {(["all", "success", "error", "skipped"] as const).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={status === option ? "default" : "outline"}
                        className="h-11 rounded-full px-4"
                        onClick={() => {
                          setOffset(0)
                          setStatus(option)
                        }}
                      >
                        {option === "all" ? "All statuses" : option}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {isLocalDevMockMode ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full px-4"
                        onClick={handleSeedLocalData}
                        disabled={isSeeding}
                      >
                        <Sparkles className={cn("size-4", isSeeding && "animate-pulse")} />
                        Seed local traces
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full px-4"
                      onClick={() => fetchPage(true)}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {error ? (
                <Card className="rounded-[1.75rem] border-destructive/35 bg-destructive/5 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="size-5 text-destructive" />
                      <CardTitle className="text-xl">Failed to load traces</CardTitle>
                    </div>
                    <CardDescription className="text-base">{error}</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}

              {seedMessage ? (
                <Card className="rounded-[1.75rem] border-border/70 bg-primary/6 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Local seed complete</CardTitle>
                    <CardDescription className="text-base">{seedMessage}</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}

              <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
                <Card className="rounded-[1.75rem] border-border/70 bg-background/85 shadow-sm">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl">Recent model calls</CardTitle>
                        <CardDescription className="mt-1">
                          Page {(Math.floor(offset / PAGE_SIZE) || 0) + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                        </CardDescription>
                      </div>
                      {isLoading ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 sm:p-4">
                    {items.length === 0 && !isLoading ? (
                      <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                        No traces matched the current filters.
                      </div>
                    ) : null}

                    {items.map((item) => {
                      const isActive = selectedTrace?.id === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className={cn(
                            "w-full rounded-[1.4rem] border p-4 text-left transition-colors",
                            isActive
                              ? "border-primary/40 bg-primary/8 shadow-sm"
                              : "border-border/60 bg-background/70 hover:bg-muted/35"
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusTone(item.status)} className="rounded-full px-2.5 py-0.5">
                              {statusLabel(item.status)}
                            </Badge>
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 uppercase">
                              {item.source}
                            </Badge>
                          </div>
                          <p className="mt-3 truncate text-sm font-medium">{item.clerk_email}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatTimestamp(item.created_at)} • {item.model ?? "Model unavailable"} • {formatLatency(item.latency_ms)}
                          </p>
                          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                            {item.error_message ?? item.ai_output ?? item.prompt ?? item.input_body}
                          </p>
                        </button>
                      )
                    })}

                    <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-muted/20 p-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={offset === 0}
                        onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </Button>
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        {Math.min(offset + 1, total)}-{Math.min(offset + items.length, total)} of {total}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={!hasMore}
                        onClick={() => setOffset((current) => current + PAGE_SIZE)}
                      >
                        Next
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4">
                  <Card className="rounded-[1.75rem] border-border/70 bg-background/85 shadow-sm">
                    <CardHeader className="border-b border-border/60 pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">Trace detail</CardTitle>
                          <CardDescription className="mt-1">
                            Full prompt, model output, and merged transaction result.
                          </CardDescription>
                        </div>
                        {selectedTrace ? (
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            <Sparkles className="size-3.5" />
                            {selectedTrace.id.slice(0, 8)}
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                      <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">User</p>
                        <p className="mt-2 text-sm font-medium">{selectedTrace?.clerk_email ?? "No trace selected"}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{selectedTrace?.clerk_user_id ?? ""}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Model</p>
                        <p className="mt-2 text-sm font-medium">{selectedTrace?.model ?? "Unavailable"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatLatency(selectedTrace?.latency_ms ?? null)}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                        <div className="mt-2 flex items-center gap-2">
                          {selectedTrace ? (
                            <Badge variant={statusTone(selectedTrace.status)}>{statusLabel(selectedTrace.status)}</Badge>
                          ) : (
                            <p className="text-sm">Unavailable</p>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Source: {selectedTrace?.source ?? "n/a"}
                        </p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Created</p>
                        <p className="mt-2 text-sm font-medium">{formatTimestamp(selectedTrace?.created_at ?? null)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Custom rules: {selectedTrace?.used_custom_rules ? "Yes" : "No"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedTrace?.error_message ? (
                    <Card className="rounded-[1.75rem] border-destructive/30 bg-destructive/5 shadow-sm">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="size-5 text-destructive" />
                          <CardTitle className="text-lg">Logged error</CardTitle>
                        </div>
                        <CardDescription className="text-base leading-7 text-foreground/90">
                          {selectedTrace.error_message}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ) : null}

                  <div className="grid gap-4 2xl:grid-cols-2">
                    <SnippetPanel label="Input Body" value={selectedTrace?.input_body ?? "Select a trace to inspect the source message body."} />
                    <SnippetPanel label="Full Prompt" value={selectedTrace?.prompt ?? "Prompt unavailable for this trace."} />
                    <SnippetPanel label="Raw Model Output" value={selectedTrace?.ai_output ?? "Model output unavailable for this trace."} />
                    <SnippetPanel label="Parsed Output JSON" value={formatJsonBlock(selectedTrace?.parsed_output_json ?? null)} />
                    <SnippetPanel
                      label="Final Transaction JSON"
                      value={formatJsonBlock(selectedTrace?.final_transaction_json ?? null)}
                      className="2xl:col-span-2"
                    />
                  </div>

                  <Card className="rounded-[1.75rem] border-border/70 bg-background/85 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Database className="size-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Message metadata</CardTitle>
                      </div>
                      <CardDescription>
                        Extra transport data captured with the model run.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email timestamp</p>
                        <p className="mt-2 text-sm font-medium">{formatTimestamp(selectedTrace?.email_timestamp ?? null)}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Gmail message id</p>
                        <p className="mt-2 break-all font-mono text-xs">{selectedTrace?.gmail_message_id ?? "Unavailable"}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Gmail thread id</p>
                        <p className="mt-2 break-all font-mono text-xs">{selectedTrace?.gmail_thread_id ?? "Unavailable"}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            </>
          )}
        </main>
      </AppSignedIn>
    </>
  )
}

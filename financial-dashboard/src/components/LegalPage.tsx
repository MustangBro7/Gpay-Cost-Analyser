import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export const LEGAL_CONTACT_EMAIL = "abhinavmohan12@gmail.com"
export const LEGAL_LAST_UPDATED = "27 September 2026"

export interface LegalSection {
  title: string
  body: React.ReactNode
}

export function LegalPage({
  label,
  title,
  intro,
  sections,
}: {
  label: string
  title: string
  intro: React.ReactNode
  sections: LegalSection[]
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/app-logo.png"
              alt="GPay Cost Analyzer logo"
              width={32}
              height={32}
              className="rounded-full shadow-sm ring-1 ring-border/70"
            />
            <span className="truncate text-sm font-semibold tracking-tight">GPay Cost Analyzer</span>
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <article className="rounded-[1.75rem] border border-border/70 bg-card/90 p-6 shadow-sm sm:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>
          <div className="mt-6 text-base leading-7 text-muted-foreground">{intro}</div>

          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{section.title}</h2>
                <div className="space-y-3 text-sm leading-6 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-foreground">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </article>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 py-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>
        </footer>
      </main>
    </div>
  )
}

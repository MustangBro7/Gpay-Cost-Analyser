'use client'

import Link from "next/link"

const designs = [
  {
    id: 1,
    name: "Noir Ledger",
    description: "Dark, cinematic dashboard with dramatic shadows, gold accents, and editorial typography. Inspired by luxury finance and film noir aesthetics.",
    aesthetic: "Dark / Luxury / Editorial",
  },
  {
    id: 2,
    name: "Glassmorphic Aurora",
    description: "Frosted glass cards floating over animated gradient mesh backgrounds. Ethereal, modern, with depth and translucency.",
    aesthetic: "Glassmorphism / Ethereal / Gradient",
  },
  {
    id: 3,
    name: "Neo Brutalist",
    description: "Bold borders, raw typography, clashing colors, and intentionally rough edges. Anti-design that commands attention.",
    aesthetic: "Brutalist / Raw / Maximalist",
  },
  {
    id: 4,
    name: "Zen Garden",
    description: "Ultra-minimal with Japanese-inspired aesthetics. Generous whitespace, delicate lines, muted earth tones, and serene composition.",
    aesthetic: "Minimal / Japanese / Organic",
  },
  {
    id: 5,
    name: "Retro Terminal",
    description: "CRT monitor aesthetic with phosphor green text, scanlines, and monospace typography. Nostalgic hacker vibes meet modern data viz.",
    aesthetic: "Retro / Terminal / Cyberpunk",
  },
]

export default function DesignsIndex() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 tracking-tight">UI Design Showcase</h1>
        <p className="text-white/60 mb-12 text-lg">Choose your preferred dashboard aesthetic. Each design is fully functional with sample data.</p>
        
        <div className="grid gap-6">
          {designs.map((design) => (
            <Link
              key={design.id}
              href={`/designs/${design.id}`}
              className="group block border border-white/10 rounded-2xl p-6 hover:border-white/30 transition-all duration-300 hover:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-white/40">0{design.id}</span>
                    <h2 className="text-xl font-semibold group-hover:text-white/90 transition-colors">{design.name}</h2>
                  </div>
                  <p className="text-white/50 mb-3 max-w-xl">{design.description}</p>
                  <span className="inline-block text-xs px-3 py-1 rounded-full border border-white/20 text-white/60">
                    {design.aesthetic}
                  </span>
                </div>
                <span className="text-white/20 group-hover:text-white/60 transition-colors text-2xl">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

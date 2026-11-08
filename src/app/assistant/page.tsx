"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowUp, CheckCircle2, Circle, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react"
import { PageHeader, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { answer, suggested, type Answer } from "@/lib/assistant"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type Turn = { q: string; a: Answer; vote?: "up" | "down" }

// Gates before any client sees this. Graded answers feed gate 2.
const GATES = [
  { name: "Internal testing", detail: "Aalpha team only", done: true },
  { name: "Accuracy", detail: "95% of 200 graded answers marked right", done: false },
  { name: "No leakage", detail: "Each answer reads one client's data only, tested against every client pair", done: false },
  { name: "Owner pilot", detail: "Two client owners, read-only, for two weeks", done: false },
]

export default function Assistant() {
  const { s } = useStore()
  const [q, setQ] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [turns.length])
  const ask = (text: string) => { if (!text.trim()) return; setTurns((x) => [...x, { q: text.trim(), a: answer(s, text) }]); setQ("") }
  const graded = turns.filter((x) => x.vote).length
  const right = turns.filter((x) => x.vote === "up").length

  return (
    <>
      <PageHeader title="Ask Studio" sub="Plain questions about clients, the week, costs and how we do things. Answers come from the Studio's own data and the Library, with sources." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[520px] flex-col rounded-[var(--radius-card)] border bg-card">
          <div className="flex-1 space-y-5 p-5">
            {turns.length === 0 && (
              <div className="flex flex-col items-start gap-4">
                <span className="grid size-10 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--bronze)]"><Sparkles className="size-5" /></span>
                <p className="max-w-lg text-sm text-[var(--text-secondary)]">Ask anything about our clients or how we deliver. If it isn&apos;t in the Studio, I&apos;ll say so instead of guessing.</p>
                <div className="flex flex-wrap gap-2">{suggested(s).map((x) => <button key={x} onClick={() => ask(x)} className="h-8 rounded-full border px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]">{x}</button>)}</div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="self-end rounded-2xl rounded-br-md bg-[var(--graphite)] px-4 py-2.5 text-sm text-white">{t.q}</div>
                <div className="flex max-w-2xl flex-col gap-2 rounded-2xl rounded-bl-md bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed">
                  {t.a.lines.map((l, j) => <p key={j}>{l}</p>)}
                  {t.a.sources.length > 0 && <div className="flex flex-wrap items-center gap-1.5 border-t pt-2 text-xs text-[var(--text-muted)]">From: {t.a.sources.map((src) => <Link key={src.href + src.label} href={src.href} className="rounded-full border bg-card px-2 py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{src.label}</Link>)}</div>}
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <span className="mr-1">Right?</span>
                    {(["up", "down"] as const).map((v) => <button key={v} aria-label={v === "up" ? "Answer was right" : "Answer was wrong"} aria-pressed={t.vote === v} onClick={() => setTurns((x) => x.map((y, k) => (k === i ? { ...y, vote: v } : y)))} className={cn("grid size-7 place-items-center rounded-full hover:bg-card", t.vote === v && (v === "up" ? "text-[var(--delta-good)]" : "text-[var(--delta-bad)]"))}>{v === "up" ? <ThumbsUp className="size-3.5" /> : <ThumbsDown className="size-3.5" />}</button>)}
                  </div>
                </div>
                {i === turns.length - 1 && <div className="flex flex-wrap gap-2">{t.a.next.map((x) => <button key={x} onClick={() => ask(x)} className="h-7 rounded-full border px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">{x}</button>)}</div>}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a client, your week, or how to do something" className="h-11 flex-1 rounded-xl" aria-label="Question" />
            <Button type="submit" size="icon" className="size-11 rounded-xl" aria-label="Ask"><ArrowUp /></Button>
          </form>
        </section>

        <div className="flex flex-col gap-4">
          <Section title="Before clients get it" sub="Stays inside Aalpha until every gate is green">
            {GATES.map((g) => (
              <div key={g.name} className="flex gap-2.5 border-t py-2.5 first:border-t-0">
                {g.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--status-good)]" /> : <Circle className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" />}
                <span className="flex flex-col text-sm"><span className="font-medium">{g.name}</span><span className="text-xs text-[var(--text-muted)]">{g.detail}</span></span>
              </div>
            ))}
          </Section>
          <Section title="This session">
            <div className="flex items-baseline justify-between text-sm"><span>Answers graded</span><span className="font-semibold tabular-nums">{graded}</span></div>
            <div className="mt-2 flex items-baseline justify-between text-sm"><span>Marked right</span><span className="font-semibold tabular-nums">{graded ? `${Math.round((right / graded) * 100)}%` : "–"}</span></div>
            <p className="mt-3 flex items-start gap-2 text-xs text-[var(--text-muted)]"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />Prototype: answers are built from rules over Studio data, no AI model yet. Pay rates and screenshots are never used.</p>
          </Section>
          <span className="self-start"><Pill t="muted">Internal only</Pill></span>
        </div>
      </div>
    </>
  )
}

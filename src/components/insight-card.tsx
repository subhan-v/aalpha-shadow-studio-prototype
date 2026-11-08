"use client"

// One card for every insight, everywhere (build spec Part 4): the number, what it rests on and
// when it was updated, the rows behind it, one action, and four feedback buttons that feed the
// learning loop. A number from a stage that's behind shows its last good value and says so.

import { useState } from "react"
import { AlertTriangle, Check, ChevronRight, Info } from "lucide-react"
import { RowsSheet } from "@/components/rows-sheet"
import { coverage, DEPTH_LABEL, FEEDBACK, lastGood, myFeedback, stale, type Ctx, type Entry, type Result } from "@/lib/insights"
import { isOpen, newRequest } from "@/lib/requests"
import { useStore } from "@/lib/store"
import type { FeedbackAction } from "@/lib/types"
import { cn } from "@/lib/utils"

const TONE = { good: "text-[var(--delta-good)]", warn: "text-[var(--watch-fg)]", bad: "text-[var(--delta-bad)]" }

export function InsightCard({ x, e, r, role, go }: { x: Ctx; e: Entry; r: Result; role: string; go: (tab: string) => void }) {
  const { s, mutate } = useStore()
  const [clicked, setClicked] = useState(false)
  // A request already open for this action stays "Sent" after a reload.
  const asked = clicked || (!!r.action?.request && s.requests.some((q) => q.clientId === x.c.id && q.title === r.action!.request && isOpen(q)))
  const [how, setHow] = useState(false)
  const who = x.me.name
  const mine = myFeedback(s, x.c.id, e.id, who)
  const old = stale(s, e)
  const cov = coverage(x, r)
  const ask = (title: string) => {
    mutate((p) => newRequest(p, { clientId: x.c.id, from: `${who} (${x.c.name})`, source: "Client app", kind: "Change", title, detail: `From the "${e.question}" card: ${r.value}${r.unit ? ` ${r.unit}` : ""}, ${r.line}.`, priority: "Normal", assignee: "Subhan" }))
    setClicked(true)
  }
  const act = () => { if (r.action?.go) go(r.action.go); else if (r.action?.request) ask(r.action.request) }
  const give = (a: FeedbackAction) => {
    mutate((p) => ({ ...p, feedback: [...(p.feedback ?? []), { id: `fb${Date.now()}`, clientId: x.c.id, insightId: e.id, action: a, by: who, role, at: p.today, version: e.version }] }))
    if (a === "Act on it" && r.action) act()
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">{e.question}</h3>
        {e.stage === "Beta" && <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-muted)]">New</span>}
      </div>
      <RowsSheet title={r.evidence.title} description={`${e.question} · ${DEPTH_LABEL[e.depth]} · definition ${e.version}`} columns={r.evidence.columns} rows={r.evidence.rows}>
        <div className="flex flex-col gap-1 pr-6">
          <span className={cn("text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums", r.tone && TONE[r.tone], old && "opacity-60")}>
            {r.value}{r.unit && <span className="ml-1.5 text-base font-normal text-[var(--text-muted)]">{r.unit}</span>}
          </span>
          <span className="text-sm text-[var(--text-secondary)]">{r.line}</span>
        </div>
      </RowsSheet>
      {old
        ? <p className="flex items-center gap-1.5 text-xs text-[var(--watch-fg)]"><AlertTriangle className="size-3.5 shrink-0" />Updating, back shortly. This is the last good value, from {lastGood(x.today)}.</p>
        : <p className="text-xs text-[var(--text-muted)]">{DEPTH_LABEL[e.depth]}{cov ? ` · ${cov}` : ""} · updated 6:04am</p>}
      <div className="flex flex-wrap items-center gap-2">
        {r.action && (asked
          ? <span className="inline-flex h-8 items-center gap-1.5 text-sm text-[var(--delta-good)]"><Check className="size-4" />Sent to Subhan</span>
          : <button onClick={act} className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[var(--graphite)] px-3 text-sm font-medium text-white">{r.action.label}<ChevronRight className="size-3.5" /></button>)}
        <button onClick={() => setHow(!how)} aria-expanded={how} className="inline-flex h-8 items-center gap-1 rounded-[10px] px-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Info className="size-3.5" />How we count this</button>
      </div>
      {how && <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">{e.how} Definition {e.version}.</p>}
      <div className="flex flex-wrap gap-1 border-t pt-3" role="group" aria-label="Was this useful?">
        {FEEDBACK.map((a) => (
          <button key={a} onClick={() => give(a)} aria-pressed={mine?.action === a}
            className={cn("h-7 rounded-full border px-2.5 text-xs", mine?.action === a ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]")}>{a}</button>
        ))}
      </div>
    </article>
  )
}

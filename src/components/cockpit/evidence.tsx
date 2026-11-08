"use client"

// Evidence (audit 3.4): the raw runs behind each workflow, Slack detail, and
// why the model grouped them. Admin only; the client never sees this.

import { useState } from "react"
import { Link2 } from "lucide-react"
import { Pill, Section, Shown } from "@/components/bits"
import { ToolChip } from "@/components/sop-view"
import { slackAsks } from "@/lib/client-data"
import { addDays, fmt, hash } from "@/lib/dates"
import { dayN } from "@/lib/engine"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

export function EvidenceTab({ c }: { c: Client }) {
  const { s } = useStore()
  const [source, setSource] = useState<"All" | "Desktop" | "Slack">("All")
  const [open, setOpen] = useState<string | null>(null)
  const n = dayN(c, s.today) ?? -1
  const found = c.workflows.filter((w) => w.discoveredDay <= n && !w.mergedInto)
  const runs = found.flatMap((w) =>
    Array.from({ length: 3 }, (_, i) => {
      const h = hash(w.id + i)
      const seat = c.seats[Math.floor(h * c.seats.length)]
      const slack = w.tools.includes("slack") && i === 2
      return {
        id: `${w.id}-r${i}`, w, person: seat.name, date: addDays(s.today, -Math.floor(h * 13)), mins: Math.round(w.minMin + h * (w.maxMin - w.minMin)),
        source: slack ? "Slack" : "Desktop", tools: w.tools.slice(0, 3 + (i % 2)),
        why: `Same steps as ${w.runs - 1} other runs: ${w.tools.slice(0, 3).map((t) => t.toUpperCase()).join(" then ")}, similar window titles, and a ${slack ? "request in a client channel" : "repeat at the start of the week"}.`,
      }
    }),
  ).sort((a, b) => b.date.localeCompare(a.date))
  const shown = runs.filter((r) => source === "All" || r.source === source)
  const asks = slackAsks(c, s.today)

  return (
    <div className="flex flex-col gap-4">
      <Section title="Runs" sub="Each time someone did a piece of work. Grouped into workflows by the model; the reason is under each run."
        right={<div className="flex rounded-xl border bg-card p-1">{(["All", "Desktop", "Slack"] as const).map((x) => <button key={x} aria-pressed={source === x} onClick={() => setSource(x)} className={cn("h-8 rounded-[9px] px-3 text-sm", source === x ? "bg-[var(--graphite)] text-white" : "text-[var(--text-secondary)]")}>{x}</button>)}</div>}>
        {shown.length === 0 && <p className="py-4 text-sm text-[var(--text-muted)]">No runs yet. They appear once people are recording.</p>}
        <div className="flex flex-col">
          {shown.slice(0, 30).map((r) => (
            <div key={r.id} className="border-t first:border-t-0">
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="grid w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left sm:grid-cols-[72px_minmax(0,1.3fr)_minmax(0,1fr)_70px_80px]">
                <span className="font-mono text-xs text-[var(--text-muted)]">{fmt(r.date)}</span>
                <span className="truncate text-sm font-medium">{r.w.name}</span>
                <span className="hidden truncate text-xs text-[var(--text-secondary)] sm:block">{r.person}</span>
                <span className="hidden text-right text-sm tabular-nums sm:block">{r.mins}m</span>
                <Pill t={r.source === "Slack" ? "info" : "muted"} className="justify-self-end">{r.source}</Pill>
              </button>
              {open === r.id && (
                <div className="mb-3 flex flex-col gap-2 rounded-xl bg-[var(--surface-2)] p-3">
                  <div className="flex flex-wrap gap-1">{r.tools.map((t) => <ToolChip key={t} t={t} compact />)}</div>
                  <p className="text-xs text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">Why it was grouped:</b> {r.why}</p>
                  <p className="text-xs text-[var(--text-muted)]">{APP} named the workflow: {r.w.rawName}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <Shown n={30} of={shown.length} hint="The newest runs are first." />
      </Section>
      <Section title="Slack asks" sub="Requests found in client channels, and the run that followed">
        {!asks ? <p className="py-2 text-sm text-[var(--text-muted)]">Slack not connected.</p> : asks.rows.map((r) => (
          <div key={r.topic} className="grid grid-cols-[minmax(0,1fr)_70px_70px_90px] items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
            <span>{r.topic}</span><span className="text-right tabular-nums">{r.done} done</span><span className="text-right tabular-nums text-[var(--watch-fg)]">{r.open} open</span>
            <span className="flex items-center justify-end gap-1 text-xs text-[var(--text-secondary)]"><Link2 className="size-3.5" />{Math.round(r.done * asks.linkedPct / 100)} linked</span>
          </div>
        ))}
      </Section>
    </div>
  )
}

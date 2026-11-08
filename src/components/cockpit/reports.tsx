"use client"

import { useState } from "react"
import { Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { fmt } from "@/lib/dates"
import { newReport } from "@/lib/engine"
import { useStore } from "@/lib/store"
import type { Client, Report } from "@/lib/types"
import { cn } from "@/lib/utils"

const KINDS: [Report["kind"], string][] = [["wpu", "Weekly Progress Update"], ["scorecard", "Monthly scorecard"], ["ceo", "CEO summary"], ["day90", "Day-90 report"]]

/** Generate, edit, approve and send. Client requests land here as drafts. */
export function ReportsTab({ c }: { c: Client }) {
  const { s, update } = useStore()
  const [open, setOpen] = useState<string | null>(c.reports.find((r) => r.status !== "sent")?.id ?? null)
  const set = (id: string, patch: Partial<Report>) => update(c.id, (x) => ({ ...x, reports: x.reports.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const send = (r: Report) =>
    update(c.id, (x, t) => {
      const fri = r.kind === "wpu" ? r.id.slice(-10) : null
      return { ...x, reports: x.reports.map((y) => (y.id === r.id ? { ...y, status: "sent", sent: t } : y)), updatesSent: fri && !x.updatesSent.includes(fri) ? [...x.updatesSent, fri] : x.updatesSent, log: [{ date: t, text: `${r.title} sent to the client.` }, ...x.log] }
    })
  const requests = c.reports.filter((r) => r.kind === "custom" && r.status !== "sent")

  return (
    <div className="flex flex-col gap-4">
      <Section title="New report" sub="Drafted from the client's data. Nothing goes out until someone approves it.">
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([k, label]) => (
            <Button key={k} variant="outline" className="h-10 rounded-xl" onClick={() => { const r = newReport(c, k, s.today); const have = c.reports.find((y) => y.id === r.id); if (have) { setOpen(have.id); return } update(c.id, (x) => ({ ...x, reports: [r, ...x.reports] })); setOpen(r.id) }}>{label}</Button>
          ))}
        </div>
      </Section>
      {requests.length > 0 && <p className="rounded-xl bg-[var(--watch-bg)] px-4 py-2.5 text-sm text-[var(--watch-fg)]">{requests.length} client {requests.length === 1 ? "request" : "requests"} waiting below.</p>}
      <Section title="Reports" sub={`${c.reports.length} total`}>
        <div className="flex flex-col">
          {c.reports.map((r) => (
            <div key={r.id} className="border-t first:border-t-0">
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left">
                <span className="min-w-56 flex-1 text-sm font-medium">{r.title}{r.request ? <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">from the client</span> : null}</span>
                <span className="text-xs text-[var(--text-muted)]">{r.period}</span>
                <span className="w-24 font-mono text-xs text-[var(--text-muted)]">{fmt(r.sent ?? r.created)}</span>
                <Pill t={r.status === "sent" ? "good" : r.status === "approved" ? "info" : "warn"}>{r.status === "sent" ? "Sent" : r.status === "approved" ? "Approved" : "Draft"}</Pill>
              </button>
              {open === r.id && (
                <div className={cn("mb-3 flex flex-col gap-3 rounded-2xl border bg-[var(--surface-2)] p-4")}>
                  {r.request && <p className="text-sm"><span className="text-[var(--text-muted)]">Client asked: </span>{r.request}</p>}
                  <Textarea value={r.summary} disabled={r.status === "sent"} onChange={(e) => set(r.id, { summary: e.target.value })} className="min-h-24 rounded-xl bg-card text-sm" aria-label="Summary" />
                  <div className="flex justify-end gap-2">
                    {r.status === "draft" && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => set(r.id, { status: "approved" })}>Approve</Button>}
                    {r.status !== "sent" && <Button size="sm" className="rounded-[10px]" onClick={() => send(r)} disabled={r.status === "draft"} title={r.status === "draft" ? "Approve first" : undefined}>Send to client</Button>}
                    {r.status === "sent" && <span className="text-xs text-[var(--text-muted)]">Sent {fmt(r.sent!)}. Visible in the client&apos;s Reports.</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

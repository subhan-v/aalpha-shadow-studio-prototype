"use client"

// Pipeline (audit 3.4): this client's batches, analyses, failures and AI cost.

import { Kpi, Pill, Section } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hash } from "@/lib/dates"
import { device } from "@/lib/engine"
import { useStore } from "@/lib/store"
import { canMoney } from "@/lib/access"
import { cost30 } from "@/lib/finance"
import type { Client } from "@/lib/types"

export function PipelineTab({ c }: { c: Client }) {
  const { s } = useStore()
  const rows = c.seats.map((x) => ({ x, d: device(x, c, s) }))
  const sum = (k: "uploads" | "mb" | "failed" | "waiting") => rows.reduce((n, r) => n + r.d[k], 0)
  const k = cost30(s, c)
  const failing = s.sim.pipelineFailing
  const errors = failing ? [["vision_provider_error", 0.94], ["upload_timeout", 0.04], ["ocr_empty", 0.02]] : [["upload_timeout", 0.6], ["ocr_empty", 0.4]]
  const hours = Array.from({ length: 12 }, (_, i) => ({ h: i + 10, ok: failing && i >= 9 ? 0 : Math.round(rows.length * (2 + hash(c.id + i) * 4)), bad: failing ? Math.round(rows.length * (0.6 + hash(c.id + "f" + i))) : Math.round(hash(c.id + "f" + i) * 2) }))
  const max = Math.max(1, ...hours.map((h) => Math.max(h.ok, h.bad)))
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Kpi label="Uploads, 24h" value={sum("uploads").toLocaleString()} note={`${sum("failed").toLocaleString()} failed`} />
        <Kpi label="Activity received, 24h" value={`${(sum("mb") / 1024).toFixed(1)} GB`} />
        <Kpi label="Analyses waiting" value={sum("waiting").toLocaleString()} t={failing ? "bad" : undefined} note={failing ? "oldest over 24h" : "oldest under 10 min"} />
        {canMoney(s) && <Kpi label="AI cost, 30 days" value={`$${k.ai.toLocaleString()}`} note={k.seatDays ? `$${k.perSeatDay.toFixed(2)} a person a day` : "Not started"} />}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section title="Analyses per hour" sub="This client, last 12 hours">
          <div className="flex h-36 items-end gap-2 border-b">
            {hours.map((h) => <div key={h.h} title={`${h.h}:00 finished ${h.ok}, failed ${h.bad}`} className="flex h-full flex-1 items-end justify-center gap-0.5"><div className="w-[45%] max-w-3 rounded-t-[3px] bg-[var(--graphite)]" style={{ height: `${Math.max(1, (h.ok / max) * 100)}%` }} /><div className="w-[45%] max-w-3 rounded-t-[3px] bg-[var(--status-critical)]" style={{ height: `${Math.max(1, (h.bad / max) * 100)}%` }} /></div>)}
          </div>
          <div className="flex gap-2 pt-1">{hours.map((h) => <span key={h.h} className="flex-1 text-center text-xs text-[var(--text-muted)]">{h.h}</span>)}</div>
          <div className="mt-2 flex gap-3 text-xs text-[var(--text-secondary)]"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--graphite)]" />Finished</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--status-critical)]" />Failed</span></div>
        </Section>
        <Section title="Failures by error" sub="Last 24 hours">
          {errors.map(([e, p]) => <div key={e as string} className="grid grid-cols-[minmax(0,1fr)_50px] items-center gap-3 border-t py-2.5 first:border-t-0"><span className="truncate font-mono text-xs">{e}</span><span className="text-right text-sm tabular-nums">{Math.round((p as number) * 100)}%</span></div>)}
          <p className="mt-2 text-xs text-[var(--text-muted)]">Toggle “Vision errors” in the top bar to see a healthy pipeline.</p>
        </Section>
      </div>
      <Section title="Computers" sub="This client only, problems first">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Status</TableHead><TableHead>Last data</TableHead><TableHead>App</TableHead><TableHead className="text-right">Uploads</TableHead><TableHead className="text-right">Data</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Waiting</TableHead>{canMoney(s) && <TableHead className="text-right">AI today</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {[...rows].sort((a, b) => (a.d.status === "Active") === (b.d.status === "Active") ? 0 : a.d.status === "Active" ? 1 : -1).map(({ x, d }) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.name}</TableCell>
                  <TableCell><Pill t={d.status === "Active" ? "good" : d.status === "Silent" ? "bad" : d.status === "Low data" ? "warn" : "muted"}>{d.status}</Pill></TableCell>
                  <TableCell className="font-mono text-xs">{d.last}</TableCell><TableCell className="font-mono text-xs text-[var(--text-muted)]">{d.version}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.uploads.toLocaleString()}</TableCell><TableCell className="text-right tabular-nums">{d.mb} MB</TableCell>
                  <TableCell className="text-right tabular-nums">{d.failed}</TableCell><TableCell className="text-right tabular-nums">{d.waiting.toLocaleString()}</TableCell>{canMoney(s) && <TableCell className="text-right tabular-nums">${d.cost.toFixed(2)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </div>
  )
}

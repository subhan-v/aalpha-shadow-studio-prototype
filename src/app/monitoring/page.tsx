"use client"

import Link from "next/link"
import { useState } from "react"
import { Kpi, Pill, Section, Segmented } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { device, seatStats } from "@/lib/engine"
import { hash } from "@/lib/dates"
import { useStore } from "@/lib/store"
import { canMoney } from "@/lib/access"

const ORDER: Record<string, number> = { Silent: 0, "Not installed": 1, "Low data": 2, Active: 3 }

export default function Monitoring() {
  const { s } = useStore()
  const t = s.today
  const [client, setClient] = useState("all")
  const clients = s.clients.filter((c) => c.kickoffDate && c.kickoffDate <= t)
  const shown = clients.filter((c) => client === "all" || c.id === client)
  const rows = shown.flatMap((c) => c.seats.map((x) => ({ c, x, d: device(x, c, s) }))).sort((a, b) => ORDER[a.d.status] - ORDER[b.d.status] || b.d.cost - a.d.cost)
  const sum = (k: "uploads" | "mb" | "failed" | "waiting") => rows.reduce((n, r) => n + r.d[k], 0)
  const active = rows.filter((r) => r.d.status === "Active" || r.d.status === "Low data").length
  const inst = rows.filter((r) => r.d.status !== "Not installed").length
  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = hash(t + i)
    const ok = s.sim.pipelineFailing && i >= 9 ? 0 : Math.round(60 + h * 120)
    const bad = s.sim.pipelineFailing ? Math.round(25 + h * 80) : Math.round(h * 3)
    return { label: `${10 + i}`, ok, bad }
  })
  const max = Math.max(...hours.map((h) => Math.max(h.ok, h.bad)), 1)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Activity</h1>
          <p className="text-sm text-[var(--text-secondary)]">Every computer, every Slack workspace and the pipeline. In the real Studio this refreshes every 5 minutes.</p>
        </div>
        <Segmented label="Client" value={client} onChange={setClient} options={[{ id: "all", label: "All" }, ...clients.map((c) => ({ id: c.id, label: c.name.split(" ")[0] }))]} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Kpi label="Computers active now" value={`${active} / ${rows.length}`} note={`${inst - active} silent, ${rows.length - inst} not installed`} t={inst - active ? "warn" : undefined} />
        <Kpi label="Uploads, 24h" value={sum("uploads").toLocaleString()} note={`${sum("failed").toLocaleString()} failed`} />
        <Kpi label="Activity received, 24h" value={`${(sum("mb") / 1024).toFixed(1)} GB`} note={`${active ? Math.round(sum("mb") / active) : 0} MB a computer`} />
        <Kpi label="Analyses waiting" value={sum("waiting").toLocaleString()} t={s.sim.pipelineFailing ? "bad" : undefined} note={s.sim.pipelineFailing ? "oldest over 24h" : "oldest under 10 min"} />
        <Kpi label="Slack messages, 24h" value={shown.filter((c) => c.slackConnected).reduce((n, c) => n + Math.round(c.seats.length * (90 + hash(c.id + t) * 80)), 0).toLocaleString()} note={`${shown.filter((c) => c.slackConnected).length} workspaces`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Analyses per hour" sub="Last 12 hours, all clients" right={<div className="flex gap-3 text-xs text-[var(--text-secondary)]"><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[var(--series-5)]" />Finished</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[var(--series-4)]" />Failed</span></div>}>
          <div className="flex h-40 items-end gap-2 border-b">
            {hours.map((h) => (
              <div key={h.label} className="flex h-full flex-1 items-end justify-center gap-0.5" title={`${h.label}:00 · finished ${h.ok}, failed ${h.bad}`}>
                <div className="w-[45%] max-w-3.5 rounded-t-[3px] bg-[var(--series-5)]" style={{ height: `${Math.max(1, (h.ok / max) * 100)}%` }} />
                <div className="w-[45%] max-w-3.5 rounded-t-[3px] bg-[var(--series-4)]" style={{ height: `${Math.max(1, (h.bad / max) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">{hours.map((h) => <span key={h.label} className="flex-1 text-center text-xs text-[var(--text-muted)]">{h.label}</span>)}</div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">{s.sim.pipelineFailing ? "Top failure: vision provider error. Nothing has finished in the last 3 hours." : "Pipeline healthy."}</p>
        </Section>
        <Section title="Slack" sub="Per client workspace">
          <Table>
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Connection</TableHead><TableHead className="text-right">Messages 24h</TableHead><TableHead>Last data</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Link href={`/clients/${c.id}`} className="hover:underline">{c.name}</Link></TableCell>
                  <TableCell>{c.slackConnected ? <Pill t="good">Connected</Pill> : <Pill t="bad">Not connected</Pill>}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.slackConnected ? Math.round(c.seats.length * (90 + hash(c.id + t) * 80)).toLocaleString() : 0}</TableCell>
                  <TableCell className="font-mono text-xs">{c.slackConnected ? `${Math.round(2 + hash(c.id) * 9)}m ago` : "never"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>

      <Section title="Computers" sub={`Problems first · ${shown.map((c) => `${c.name.split(" ")[0]} ${seatStats(c, t).active}/${c.seats.length}`).join(" · ")}`}>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Person</TableHead><TableHead>Status</TableHead><TableHead>Last data</TableHead><TableHead>App</TableHead><TableHead className="text-right">Uploads 24h</TableHead><TableHead className="text-right">Data 24h</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Waiting</TableHead>{canMoney(s) && <TableHead className="text-right">AI cost today</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {rows.slice(0, 40).map(({ c, x, d }) => (
                <TableRow key={x.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="font-medium">{x.name}</TableCell>
                  <TableCell><Pill t={d.status === "Active" ? "good" : d.status === "Silent" ? "bad" : d.status === "Low data" ? "warn" : "muted"}>{d.status}</Pill></TableCell>
                  <TableCell className="font-mono text-xs">{d.last}</TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-secondary)]">{d.version}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.uploads}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.mb} MB</TableCell>
                  <TableCell className="text-right tabular-nums">{d.failed}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.waiting}</TableCell>
                  {canMoney(s) && <TableCell className="text-right tabular-nums">${d.cost.toFixed(2)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 40 && <p className="pt-2 text-xs text-[var(--text-secondary)]">Showing 40 of {rows.length}. Pick a client to see all of theirs.</p>}
        </div>
      </Section>
    </>
  )
}

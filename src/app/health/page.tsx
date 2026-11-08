"use client"

// Health (v19): data checks per client and source (build spec 24.1), and the incident log
// for self-healing. A failing source marks the cards that depend on it as updating; clients
// never see a stale number as current. The "Vision errors" switch in the top bar drives it.

import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { addDays, fmt, hash } from "@/lib/dates"
import { installed, silent } from "@/lib/engine"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"

type St = "ok" | "warn" | "fail" | "off"
const PILL: Record<St, { t: "good" | "warn" | "bad" | "muted"; w: string }> = { ok: { t: "good", w: "OK" }, warn: { t: "warn", w: "Watch" }, fail: { t: "bad", w: "Failing" }, off: { t: "muted", w: "Not connected" } }

export default function HealthPage() {
  const { s } = useStore()
  const t = s.today
  const vision = s.sim.pipelineFailing
  const row = (c: Client) => {
    const inst = c.seats.filter((x) => installed(x, t))
    const quiet = inst.filter((x) => silent(x, t)).length
    const ids = c.slackConnected ? Math.round(70 + hash(c.id + "id") * 30) : 0
    const conn = c.connections.calendar || c.connections.hubspot || c.connections.callNotes
    return {
      c,
      slack: (c.slackConnected ? (hash(c.id + t) < 0.08 ? "warn" : "ok") : "off") as St,
      desktop: (!inst.length ? "off" : vision ? "fail" : quiet > 1 ? "warn" : "ok") as St,
      connectors: (conn ? "ok" : "off") as St,
      identity: (!c.slackConnected ? "off" : ids >= 90 ? "ok" : "warn") as St,
      ids,
      backlog: vision ? `${Math.round(1200 + hash(c.id) * 4000)} pending` : "Clear",
    }
  }
  const rows = s.clients.map(row)
  const failing = rows.filter((r) => [r.slack, r.desktop, r.connectors, r.identity].includes("fail")).length
  const incidents = [
    ...(vision ? [{ at: t, what: "Vision analysis failing (provider error)", did: "Paused the stage, held the queue, retrying on the fallback model. Desktop cards show the last good value.", state: "Healing" }] : []),
    { at: addDays(t, -2), what: "Two Slack channels stopped syncing at one client", did: "Re-authorised and backfilled 6 hours automatically", state: "Healed" },
    { at: addDays(t, -5), what: "Duplicate desktop batches after an app update", did: "Removed 412 duplicates; checksum rule added to the data checks", state: "Healed" },
    { at: addDays(t, -9), what: "Request matching rate fell below normal", did: "Rolled back to the previous version; opened a Linear issue for Hashim", state: "Sent to Linear" },
  ]

  return (
    <>
      <PageHeader title="Health" sub="Is the data coming in right? Checked every pipeline cycle, per client and source." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Clients with a failing source" value={failing} t={failing ? "bad" : undefined} />
        <Kpi label="Vision backlog" value={vision ? "Growing" : "Clear"} note={vision ? "Oldest item over a day" : "Under one day's volume"} t={vision ? "bad" : undefined} />
        <Kpi label="Incidents healed this month" value={incidents.filter((i) => i.state === "Healed").length} note={`${incidents.filter((i) => i.state === "Sent to Linear").length} sent to Linear`} />
      </div>
      <Section title="Data checks" sub="Freshness, volume, completeness, duplicates, identity coverage and tenant isolation. A failing source sets its cards to 'Updating'.">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Slack</TableHead><TableHead>Desktop</TableHead><TableHead>Connectors</TableHead><TableHead>People matched</TableHead><TableHead>Backlog</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.c.id}>
                  <TableCell className="font-medium">{r.c.name}</TableCell>
                  {[r.slack, r.desktop, r.connectors].map((x, i) => <TableCell key={i}><Pill t={PILL[x].t}>{PILL[x].w}</Pill></TableCell>)}
                  <TableCell><Pill t={PILL[r.identity].t}>{r.identity === "off" ? "No Slack yet" : `${r.ids}%`}</Pill></TableCell>
                  <TableCell className="tabular-nums">{r.backlog}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Tenant isolation: no record found under the wrong client in the last check. A failure here stops the stage (P0).</p>
      </Section>
      <Section title="Incidents" sub="What broke, what the system did about it, and what went to Hashim">
        <ul className="flex flex-col text-sm">
          {incidents.map((i) => (
            <li key={i.what} className="flex flex-wrap items-start gap-3 border-t py-3 first:border-t-0">
              <Pill t={i.state === "Healed" ? "good" : i.state === "Healing" ? "warn" : "info"}>{i.state}</Pill>
              <span className="flex min-w-0 flex-1 flex-col"><span className="font-medium">{i.what}</span><span className="text-xs text-[var(--text-secondary)]">{i.did}</span></span>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">{fmt(i.at)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

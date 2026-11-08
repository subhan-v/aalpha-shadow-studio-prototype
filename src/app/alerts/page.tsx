"use client"

import Link from "next/link"
import { Kpi, Section, SevPill } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { addDays } from "@/lib/dates"
import { alerts } from "@/lib/engine"
import { newRequest } from "@/lib/requests"
import { useStore } from "@/lib/store"
import type { Alert, Settings, State } from "@/lib/types"

/** Hand an alert with no routine fix to a person: it becomes a request for them, and the alert is hidden for 3 days. */
function handOff(p: State, a: Alert, to: string): State {
  const n = newRequest(p, { clientId: a.clientId, from: "Alert", source: "Alert", kind: "Bug", title: a.title, detail: a.detail, priority: a.severity === "Critical" ? "Urgent" : "High", assignee: to })
  return { ...n, acks: { ...n.acks, [a.key]: addDays(p.today, 3) } }
}

// The rules read their numbers from Settings, so what this page says is what the alerts use.
const rules = (k: Settings) => [
  ["Silent computer", `No data for ${k.silentHours} working hours from a seat that should record`, "Warning, critical after 1 day"],
  ["Install overdue", "48-hour clock passed with seats missing (Requirement 1)", "Critical"],
  ["Upload drop", `A computer's uploads fall more than ${k.uploadDropPct}% against its 7-day average`, "Warning"],
  ["Failure spike", `More than ${k.failurePct}% of analyses fail in an hour`, "Critical"],
  ["Queue stuck", `Oldest waiting analysis older than ${k.queueHours} hours`, "Critical"],
  ["Slack stale", "No Slack data on a working day", "Warning"],
  ["Below the floor", `Fewer than ${k.seatFloor} people sending data`, "Critical"],
  ["Cost spike", `A computer costs more than ${k.costSpikeX}x its 7-day average`, "Warning"],
]

export default function Alerts() {
  const { s, runAlert, snooze, mutate } = useStore()
  // Client alerts go to the client's owner; platform alerts go to Hashim.
  const ownerOf = (a: Alert) => s.clients.find((c) => c.id === a.clientId)?.owner ?? "Hashim"
  const list = alerts(s)
  const crit = list.filter((a) => a.severity === "Critical")
  return (
    <>
      <div>
        <h1 className="text-2xl">Alerts</h1>
        <p className="text-sm text-[var(--text-secondary)]">Open problems across every client. Each one also shows up in that client&apos;s next actions. Snooze hides it until tomorrow.</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Open alerts" value={list.length} />
        <Kpi label="Critical" value={crit.length} t={crit.length ? "bad" : undefined} />
        <Kpi label="Clients affected" value={new Set(list.map((a) => a.clientId).filter(Boolean)).size} />
      </div>
      <Section title="Open now" sub="Fix runs the routine fix where there is one (nudges). Otherwise Hand off turns it into a request for the owner and hides it for 3 days.">
        {list.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Nothing needs you right now. To see one, switch on Vision errors in the top bar.</p>}
        {list.map((a) => (
          <div key={a.key} className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 border-t py-2.5 first:border-t-0 sm:grid-cols-[76px_minmax(0,1fr)_auto]">
            <SevPill s={a.severity} />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-snug">
                {a.clientId ? <Link href={`/clients/${a.clientId}`} className="mr-1.5 font-normal text-[var(--seq-800)] hover:underline">{a.clientName}</Link> : <span className="mr-1.5 font-normal text-[var(--text-secondary)]">{a.clientName}</span>}
                {a.title}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">{a.detail}</div>
            </div>
            <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
              {a.run ? <Button size="sm" variant="outline" onClick={() => runAlert(a.key)}>{a.cta}</Button> : <Button size="sm" variant="outline" onClick={() => mutate((p) => handOff(p, a, ownerOf(a)))}>Hand to {ownerOf(a)}</Button>}
              <Button size="sm" variant="ghost" onClick={() => snooze(a.key)}>Snooze</Button>
            </div>
          </div>
        ))}
      </Section>
      <Section title="Alert rules" sub="Change thresholds in Settings.">
        {rules(s.settings).map(([n, w, sev]) => (
          <div key={n} className="grid grid-cols-[160px_minmax(0,1fr)_auto] gap-3 border-t py-2 text-sm first:border-t-0"><b>{n}</b><span className="text-[var(--text-secondary)]">{w}</span><span className="text-xs">{sev}</span></div>
        ))}
      </Section>
    </>
  )
}

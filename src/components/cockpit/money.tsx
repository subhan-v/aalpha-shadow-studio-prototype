"use client"

// Cockpit money tabs (Studio only): one client's cost and margin over time with unit costs and
// billing, and their health: the churn signals, the monthly deliverables, and save actions.

import Link from "next/link"
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDashed, Clock, LifeBuoy, XCircle } from "lucide-react"
import { Kpi, Pill, Section } from "@/components/bits"
import { CostCharts } from "@/components/cost-chart"
import { Button } from "@/components/ui/button"
import { fmt } from "@/lib/dates"
import { billing, costWeeks, listPrice, revenueMo, unitCosts } from "@/lib/finance"
import { health, recurringMonths } from "@/lib/health"
import { newRequest } from "@/lib/requests"
import { useStore } from "@/lib/store"
import type { Client, State } from "@/lib/types"

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

export function CostsTab({ c }: { c: Client }) {
  const { s } = useStore()
  const all = costWeeks(s, c, s.today)
  // Only the weeks since the client started; a new client's chart would otherwise be mostly empty.
  const first = all.findIndex((x) => x.total > 0 || x.revenue > 0)
  const w = first < 0 ? all : all.slice(Math.min(first, all.length - 2))
  const u = unitCosts(c, all, s.today)
  const b = billing(s, c)
  const last4 = w.slice(-4)
  const cost = last4.reduce((n, x) => n + x.total, 0), rev = last4.reduce((n, x) => n + x.revenue, 0)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Pays a month" value={usd(revenueMo(s, c, s.today))} note={b.sub ? b.sub.plan : "Not started"} />
        <Kpi label="Cost, last 4 weeks" value={usd(cost)} note={`Margin ${rev ? Math.round(((rev - cost) / rev) * 100) : 0}%`} />
        <Kpi label="Per person per day" value={`$${u.perSeatDay.toFixed(2)}`} note={`Target up to $${s.settings.costTargetMax}`} t={u.perSeatDay > s.settings.costTargetMax ? "warn" : undefined} />
        <Kpi label="Per hour found" value={`$${u.perHourFound.toFixed(2)}`} note="Cost of each repeat-work hour found" />
        <Kpi label="Per hour back" value={u.perHourBack ? `$${u.perHourBack.toFixed(2)}` : "–"} note="Cost of each hour agents give back" />
      </div>
      <Section title={c.name} sub="Cost to serve this client and the margin left. Server costs come later."><CostCharts weeks={w} /></Section>
      {b.sub && (
        <Section title="Billing" sub="From Stripe (sample until it's connected)" right={<Link href={`/clients/${c.id}?tab=subscription`} className="text-sm font-medium text-[var(--bronze)] hover:underline">Manage subscription</Link>}>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>{b.sub.plan} · {usd(b.sub.amount)} a month</span>
            {b.sub.renews && <span>Renews {fmt(b.sub.renews)}</span>}
            <span>Card ending {b.sub.card.last4} · {b.sub.card.expiresSoon ? <b className="text-[var(--watch-fg)]">expires {b.sub.card.exp}</b> : `exp ${b.sub.card.exp}`}</span>
            {c.price && c.price !== listPrice(s, s.today) && <span className="text-[var(--text-secondary)]">Kept at {usd(c.price)} (list price now {usd(listPrice(s, s.today))})</span>}
          </div>
          <div className="mt-3 flex flex-col">{b.invoices.slice(0, 4).map((i) => <span key={i.id} className="flex justify-between gap-3 border-t py-2 text-sm first:border-t-0"><span>{fmt(i.date)}</span><span className="tabular-nums">{usd(i.amount)}</span><Pill t={i.status === "paid" ? "good" : i.status === "failed" ? "bad" : "muted"}>{i.status === "paid" ? "Paid" : i.status === "failed" ? "Failed" : "Open"}</Pill></span>)}</div>
        </Section>
      )}
    </div>
  )
}

const LEVEL: Record<string, "good" | "warn" | "bad"> = { Healthy: "good", Watch: "warn", "At risk": "bad" }

/** Starts the save play for an at-risk client: a task with a script, an executive review, a Slack alert. */
export function savePlay(p: State, c: Client, reasons: string[]): State {
  const next = newRequest(p, { clientId: c.id, from: "Retention", source: "Alert", kind: "Change", title: `Save ${c.name}: book an executive review`, detail: `Why: ${reasons.join("; ")}. Script: start with what's working (hours back, live agents), own what slipped, agree two fixes with dates, and book the next review before hanging up.`, priority: "Urgent", assignee: c.owner })
  return { ...next, clients: next.clients.map((x) => (x.id === c.id ? { ...x, log: [{ date: p.today, text: `Save play started: executive review requested, alert posted to #${x.slackSlug}-internal.` }, ...x.log] } : x)) }
}

export function HealthTab({ c }: { c: Client }) {
  const { s, mutate } = useStore()
  const h = health(s, c)
  const months = recurringMonths(c, s.today)
  const started = s.requests.some((r) => r.clientId === c.id && r.title.startsWith("Save ") && r.status !== "Done")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border bg-card p-5">
        <span className="text-4xl font-semibold tabular-nums">{h.score}</span>
        <span className="flex flex-1 flex-col items-start gap-1"><Pill t={LEVEL[h.level]}>{h.level}</Pill><span className="text-sm text-[var(--text-secondary)]">{h.recurring ? "On the recurring plan" : "In the first 90 days"} · {usd(h.mrr)} a month · Studio only, the client never sees this</span></span>
        {h.level !== "Healthy" && <Button className="rounded-[10px]" disabled={started} onClick={() => mutate((p) => savePlay(p, c, h.signals.slice(0, 3).map((x) => x.text)))}><LifeBuoy />{started ? "Save play running" : "Start the save play"}</Button>}
      </div>
      <Section title="What's driving it" sub="Strongest signals first">
        {h.signals.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nothing worrying. Value, engagement, delivery and billing all look fine.</p>}
        {h.signals.map((x) => <div key={x.text} className="flex items-center gap-3 border-t py-2.5 text-sm first:border-t-0"><AlertTriangle className="size-4 text-[var(--watch-fg)]" /><span className="w-24 text-xs text-[var(--text-muted)]">{x.area}</span><span className="flex-1">{x.text}</span><span className="text-xs tabular-nums text-[var(--text-muted)]">-{x.weight}</span></div>)}
      </Section>
      <Section title="Monthly deliverables" sub={months.length ? "After day 90, every month" : "Start after day 90"}>
        {months.length === 0 && <p className="text-sm text-[var(--text-muted)]">This client is still in the first 90 days.</p>}
        {[...months].reverse().map((m) => (
          <div key={m.month} className="border-t py-3 first:border-t-0">
            <span className="text-sm font-semibold">Month {m.month} of the recurring plan <span className="font-normal text-[var(--text-muted)]">from {fmt(m.start)}</span></span>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {m.items.map((d) => <span key={d.name} className="flex items-center gap-2 text-sm">{d.status === "Done" ? <CheckCircle2 className="size-4 text-[var(--status-good)]" /> : d.status === "Late" ? <Clock className="size-4 text-[var(--watch-fg)]" /> : d.status === "Missed" ? <XCircle className="size-4 text-[var(--status-critical)]" /> : <CircleDashed className="size-4 text-[var(--text-muted)]" />}<span className="flex-1">{d.name}</span><span className="text-xs text-[var(--text-muted)]">{d.status} · {fmt(d.due)}</span></span>)}
            </div>
          </div>
        ))}
      </Section>
      <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><CalendarClock className="size-3.5" />The client sees these deliverables in their Reports, never the health score.</p>
    </div>
  )
}

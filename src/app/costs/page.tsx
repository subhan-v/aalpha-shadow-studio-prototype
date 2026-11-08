"use client"

import Link from "next/link"
import { Kpi, Pill, Section } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useStore } from "@/lib/store"
import { AlertTriangle } from "lucide-react"
import { CostCharts } from "@/components/cost-chart"
import { Button } from "@/components/ui/button"
import { cost30, costWeeks, portfolioWeeks } from "@/lib/finance"
import { newRequest } from "@/lib/requests"

const STEPS: [string, number][] = [["Screen analysis", 0.61], ["Text and OCR", 0.18], ["Slack analysis", 0.14], ["Reports and SOPs", 0.07]]

export default function Costs() {
  const { s, mutate } = useStore()
  // Revenue comes from each client's price (list price over time, or the price they signed at).
  // One cost function everywhere: the same weekly numbers as the charts (AI, storage, agent runs).
  const rows = s.clients.map((c) => ({ c, k: cost30(s, c) })).sort((a, b) => b.k.total - a.k.total)
  const weeks = portfolioWeeks(s, s.today)
  const spikes = s.clients.flatMap((c) => { const w = costWeeks(s, c, s.today); const last = w[w.length - 1]; return last.spike ? [{ c, w: last }] : [] })
  const ai = rows.reduce((n, r) => n + r.k.ai, 0)
  const storage = rows.reduce((n, r) => n + r.k.storage, 0)
  const seatDays = rows.reduce((n, r) => n + r.k.seatDays, 0)
  const revenue = rows.reduce((n, r) => n + r.k.revenue, 0)
  const agents = rows.reduce((n, r) => n + r.k.agents, 0)
  const margin = revenue ? Math.round(((revenue - ai - storage - agents) / revenue) * 100) : 0

  return (
    <>
      <div>
        <h1 className="text-2xl">Costs and margin</h1>
        <p className="text-sm text-[var(--text-secondary)]">Last 30 days. AI is measured per computer in the real data; storage is an estimate until hosting is decided.</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="AI cost" value={`$${ai.toLocaleString()}`} note="All computers" />
        <Kpi label="Agent runs" value={`$${agents.toLocaleString()}`} note="Agent credits" />
        <Kpi label="Storage (est.)" value={`$${storage.toLocaleString()}`} note="From upload volume" />
        <Kpi label="Per person per day" value={`$${seatDays ? (ai / seatDays).toFixed(2) : "0.00"}`} note={`Target up to $${s.settings.costTargetMax}`} />
        <Kpi label="Revenue this month" value={`$${revenue.toLocaleString()}`} note={`${rows.length} clients`} />
        <Kpi label="Gross margin" value={`${margin}%`} note="Before our team's time and servers" />
      </div>
      <Section title="All clients, week by week" sub="Cost to serve every client, and the margin left. Server and hosting costs come later.">
        <CostCharts weeks={weeks} title="Cost to serve, last 12 weeks" />
      </Section>
      {spikes.length > 0 && (
        <Section title="Spikes this week" sub="A week over 2x the four before">
          {spikes.map(({ c, w }) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
              <AlertTriangle className="size-4 text-[var(--status-critical)]" />
              <span className="min-w-48 flex-1"><Link href={`/clients/${c.id}?tab=costs`} className="font-medium hover:underline">{c.name}</Link><span className="block text-xs text-[var(--text-muted)]">${w.total.toLocaleString()} this week · {w.spike}</span></span>
              <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => newRequest(p, { clientId: c.id, from: "Costs", source: "Alert", kind: "Bug", title: `Cost spike at ${c.name}: $${w.total.toLocaleString()} this week`, detail: w.spike ?? "", priority: "High", assignee: "Hashim" }))}>Look into it</Button>
            </div>
          ))}
        </Section>
      )}
      <Section title="By client" sub="Above target means the screen analysis is costing more than planned for that team.">
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead className="text-right">Computer-days</TableHead><TableHead className="text-right">AI cost</TableHead><TableHead className="text-right">Storage</TableHead><TableHead className="text-right">Per person / day</TableHead><TableHead>vs target</TableHead><TableHead className="text-right">Revenue / mo</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(({ c, k }) => {
                const over = k.perSeatDay > s.settings.costTargetMax
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium"><Link href={`/clients/${c.id}`} className="hover:underline">{c.name}</Link></TableCell>
                    <TableCell className="text-right tabular-nums">{k.seatDays}</TableCell>
                    <TableCell className="text-right tabular-nums">${k.ai.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">${k.storage}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.seatDays ? `$${k.perSeatDay.toFixed(2)}` : "n/a"}</TableCell>
                    <TableCell>{!k.seatDays ? <Pill t="muted">Not started</Pill> : over ? <Pill t="warn">Above</Pill> : <Pill t="good">In range</Pill>}</TableCell>
                    <TableCell className="text-right tabular-nums">${k.revenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{k.margin}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Section>
      <Section title="AI cost by step" sub="Where the money goes">
        <div className="flex flex-col gap-2.5">
          {STEPS.map(([n, p]) => (
            <div key={n} className="grid grid-cols-[140px_minmax(0,1fr)_80px] items-center gap-3 text-sm" title={`${n}: ${Math.round(p * 100)}%`}>
              <span>{n}</span>
              <span className="h-2 rounded-full bg-[var(--surface-2)]"><span className="block h-2 rounded-full bg-[var(--series-5)]" style={{ width: `${(p / STEPS[0][1]) * 100}%` }} /></span>
              <span className="text-right font-semibold tabular-nums">${Math.round(ai * p).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

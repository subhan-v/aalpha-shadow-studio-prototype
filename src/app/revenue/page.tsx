"use client"

// Studio > Revenue: what clients pay (from Stripe, read-only), subscriptions, renewals, failed
// payments, and revenue minus the cost to serve. The recurring price is a dated setting: change
// it and new clients get the new price while existing clients keep theirs.

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, CreditCard, DollarSign, Plug, Repeat, TrendingUp } from "lucide-react"
import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmt } from "@/lib/dates"
import { billing, costWeeks, listPrice, pricingOf } from "@/lib/finance"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`

export default function Revenue() {
  const { s, mutate } = useStore()
  const [price, setPrice] = useState(String(listPrice(s, s.today)))
  const [from, setFrom] = useState(s.today)
  const rows = s.clients.map((c) => {
    const b = billing(s, c)
    const w = costWeeks(s, c, s.today).slice(-4)
    const k = 30 / 28
    const cost = w.reduce((n, x) => n + x.total, 0) * k
    return { c, b, cost, ai: w.reduce((n, x) => n + x.ai + x.storage, 0) * k, agents: w.reduce((n, x) => n + x.agents, 0) * k, rev: b.sub?.amount ?? 0 }
  })
  const subs = rows.filter((r) => r.b.sub)
  const mrr = subs.reduce((n, r) => n + r.rev, 0)
  const recurring = subs.filter((r) => r.b.sub!.plan === "Recurring")
  const billed = rows.flatMap((r) => r.b.invoices).filter((i) => i.date > s.today.slice(0, 8) + "00")
  const collected = billed.filter((i) => i.status === "paid").reduce((n, i) => n + i.amount, 0)
  const failed = rows.flatMap((r) => r.b.invoices.filter((i) => i.status === "failed").map((i) => ({ ...i, c: r.c })))
  const cost = rows.reduce((n, r) => n + r.cost, 0)
  const p = pricingOf(s)
  return (
    <>
      <PageHeader title="Revenue" sub="What clients pay, from Stripe (read-only), and what is left after the cost to serve them. Studio only." />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
        <Plug className="size-4 text-[var(--text-muted)]" />
        <span className="flex-1">{s.stripe ? <>Stripe connected {s.stripe.via === "key" ? "with a read-only key" : "through Composio (Aalpha account)"} · {fmt(s.stripe.at)} · <span className="text-[var(--text-muted)]">sample data in the prototype</span></> : "Stripe is not connected"}</span>
        <div role="radiogroup" aria-label="How Stripe connects" className="flex rounded-xl border p-1">
          {([["key", "Read-only key"], ["composio", "Composio"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={s.stripe?.via === k} onClick={() => mutate((x) => ({ ...x, stripe: { via: k, at: x.today } }))} className={cn("h-7 rounded-[8px] px-2.5 text-xs", s.stripe?.via === k ? "bg-[var(--graphite)] font-medium text-white" : "text-[var(--text-secondary)]")}>{l}</button>)}
        </div>
        {s.stripe && <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => mutate((x) => ({ ...x, stripe: null }))}>Disconnect</Button>}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi icon={<Repeat />} hue="#2a78d6" label="Monthly revenue" value={usd(mrr)} note={`${subs.length} subscriptions · ${usd(mrr * 12)} a year`} />
        <Kpi icon={<TrendingUp />} hue="#1baf7a" label="Recurring plan" value={usd(recurring.reduce((n, r) => n + r.rev, 0))} note={`${recurring.length} clients after day 90`} />
        <Kpi icon={<CreditCard />} hue="#6250d6" label="Collected this month" value={usd(collected)} note={`of ${usd(billed.reduce((n, i) => n + i.amount, 0))} billed`} />
        <Kpi icon={<AlertTriangle />} hue="#e5484d" label="Failed payments" value={failed.length} t={failed.length ? "bad" : undefined} note={failed.map((f) => f.c.name).join(", ") || "None"} />
        <Kpi icon={<DollarSign />} hue="#eda100" label="After cost to serve" value={usd(mrr - cost)} note={`${mrr ? Math.round(((mrr - cost) / mrr) * 100) : 0}% margin, before team time and servers`} />
      </div>

      <Section title="Profit and loss, this month" sub="Revenue and direct costs. Overheads (team, servers, tools) show once accounting is connected.">
        <div className="flex max-w-xl flex-col text-sm">
          {[["Revenue", mrr, false], ["AI and storage", -rows.reduce((n, r) => n + r.ai, 0), true], ["Agent run credits", -rows.reduce((n, r) => n + r.agents, 0), true], ["Gross profit", mrr - cost, false]].map(([k, v, sub]) => (
            <div key={String(k)} className={cn("flex justify-between border-t py-2 first:border-t-0", !sub && "font-semibold")}><span className={sub ? "pl-4 text-[var(--text-secondary)]" : ""}>{String(k)}</span><span className="tabular-nums">{usd(Number(v))}</span></div>
          ))}
          {["Team time", "Servers and hosting", "Tools and software"].map((k) => <div key={k} className="flex justify-between border-t py-2 text-[var(--text-muted)]"><span className="pl-4">{k}</span><span>Not connected</span></div>)}
        </div>
      </Section>

      <Section title="Subscriptions" sub="Every client, what they pay, and margin after the cost to serve them">
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Plan</TableHead><TableHead className="text-right">A month</TableHead><TableHead className="text-right">Cost to serve</TableHead><TableHead className="text-right">Margin</TableHead><TableHead>Renews</TableHead><TableHead>Card</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {subs.map(({ c, b, cost, rev }) => (
                <TableRow key={c.id}>
                  <TableCell><Link href={`/clients/${c.id}?tab=costs`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{b.sub!.plan}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(rev)}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(cost)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{rev ? Math.round(((rev - cost) / rev) * 100) : 0}%</TableCell>
                  <TableCell>{b.sub!.renews ? fmt(b.sub!.renews) : "–"}</TableCell>
                  <TableCell className={b.sub!.card.expiresSoon ? "text-[var(--watch-fg)]" : "text-[var(--text-secondary)]"}>•••• {b.sub!.card.last4} · {b.sub!.card.exp}</TableCell>
                  <TableCell><Link href={`/clients/${c.id}?tab=subscription`} className="inline-flex items-center gap-2 hover:underline"><Pill t={b.sub!.status === "active" ? "good" : b.sub!.status === "past_due" || b.sub!.status === "on_hold" ? "bad" : b.sub!.status === "ended" ? "muted" : "warn"}>{({ active: "Active", past_due: "Past due", paused: "Paused", canceling: "Cancelling", canceled: "Cancelled", on_hold: "Renewal undecided", ended: "Ended at day 90" } as const)[b.sub!.status]}</Pill><span className="text-xs text-[var(--bronze)]">Manage</span></Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Recurring price" sub="Today's list price for the plan after day 90. New clients get the price on the day they move to it; existing clients keep theirs.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">{[...p.recurring].sort((a, b) => b.from.localeCompare(a.from)).map((x) => <span key={x.from} className="flex justify-between gap-3 border-t py-2 text-sm first:border-t-0"><span>From {fmt(x.from)}</span><span className="font-semibold tabular-nums">{usd(x.monthly)} a month</span></span>)}</div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number(price); if (!v) return; mutate((x) => ({ ...x, pricing: { ...pricingOf(x), recurring: [...pricingOf(x).recurring.filter((r) => r.from !== from), { from, monthly: v }] } })) }}>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">New price, $ a month<Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-36 rounded-[10px]" /></label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Starting<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-44 rounded-[10px]" /></label>
            <Button type="submit" className="h-9 rounded-[10px]">Set price</Button>
          </form>
          <span className="text-xs text-[var(--text-muted)]">Onboarding: {usd(p.upfront)} paid upfront, or {usd(p.monthly)} a month for 3 months. {rows.filter((r) => r.c.price).length} clients are locked at their signed price.</span>
        </div>
      </Section>
    </>
  )
}

"use client"

// Studio > Retention: every client's health, revenue at risk, renewals coming up, and the save
// play for anyone at risk. Clients never see any of this.

import Link from "next/link"
import { AlertTriangle, CalendarClock, HeartPulse, LifeBuoy, Repeat } from "lucide-react"
import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { savePlay } from "@/components/cockpit/money"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { addDays, fmt } from "@/lib/dates"
import { recurringPrice } from "@/lib/finance"
import { retention } from "@/lib/health"
import { useStore } from "@/lib/store"

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`
const LEVEL = { Healthy: "good", Watch: "warn", "At risk": "bad" } as const

export default function Retention() {
  const { s, mutate } = useStore()
  const r = retention(s)
  const rows = [...r.rows].filter((x) => !!x.b.sub).sort((a, b) => a.h.score - b.h.score)
  const atRiskN = rows.filter((x) => x.h.level === "At risk").length
  const lastNrr = r.months[r.months.length - 1].nrr
  const overdue = r.renewals.filter((x) => x.overdue).length
  const reasons = Array.from(new Set(r.lost.map((x) => x.reason))).map((k) => [k, r.lost.filter((x) => x.reason === k).length] as const).sort((a, b) => b[1] - a[1])
  return (
    <>
      <PageHeader title="Retention" sub="Health for every client, scored from value, engagement, delivery, billing and people. Studio only." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi icon={<Repeat />} hue="#2a78d6" label="Monthly revenue" value={usd(r.mrr)} note={`${usd(r.arr)} a year`} />
        <Kpi icon={<AlertTriangle />} hue="#e5484d" label="Revenue at risk" value={usd(r.atRisk)} t={r.atRisk ? "bad" : undefined} note={`${atRiskN} ${atRiskN === 1 ? "client" : "clients"} at risk · ${usd(r.watch)} to watch`} />
        <Kpi icon={<HeartPulse />} hue="#1baf7a" label="Revenue kept" value={`${lastNrr}%`} note="Last month, with expansions (sample)" />
        <Kpi icon={<CalendarClock />} hue="#6250d6" label="Renewals open" value={r.renewals.length} note={overdue ? `${overdue} past day 90 and not billing` : `${usd(r.renewals.reduce((n, x) => n + recurringPrice(s, x.c), 0))} a month to decide`} t={overdue ? "bad" : undefined} />
        <Kpi icon={<Repeat />} hue="#eda100" label="Churned, last 6 months" value={r.months.reduce((n, m) => n + m.churn, 0)} note={r.lost.length ? `${r.lost.length} recorded here, the rest sample` : "Clients lost (sample)"} />
      </div>
      <Section title="Renewals" sub="Day 90 in the next 60 days, or passed without a decision. Nothing bills after day 90 until the outcome is recorded on the client's Overview.">
        {r.renewals.length === 0 ? <p className="py-2 text-sm text-[var(--text-secondary)]">No renewals due in the next 60 days.</p> : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Day 90</TableHead><TableHead>Stage</TableHead><TableHead className="text-right">A month at stake</TableHead><TableHead>Health</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {r.renewals.map((x) => (
                  <TableRow key={x.c.id}>
                    <TableCell><Link href={`/clients/${x.c.id}`} className="font-medium hover:underline">{x.c.name}</Link><span className="block text-xs text-[var(--text-muted)]">{x.c.owner}</span></TableCell>
                    <TableCell className="text-xs tabular-nums">{x.due ? fmt(addDays(x.due, -1)) : "–"}</TableCell>
                    <TableCell>{x.overdue ? <Pill t="bad">Overdue {x.overdue} {x.overdue === 1 ? "day" : "days"}</Pill> : <Pill t={x.stage === "Proposal sent" ? "info" : x.stage === "Due to open" ? "warn" : "muted"}>{x.stage}</Pill>}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(recurringPrice(s, x.c))}</TableCell>
                    <TableCell><Pill t={LEVEL[x.h.level]}>{x.h.level}</Pill></TableCell>
                    <TableCell className="text-right"><Link href={`/clients/${x.c.id}`} className="text-xs text-[var(--bronze)] hover:underline">Open renewal</Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
      <Section title="Every client, weakest first" sub="Click a client for the signals, the monthly deliverables and the save play">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Health</TableHead><TableHead className="text-right">A month</TableHead><TableHead>Top reasons</TableHead><TableHead>Renews</TableHead><TableHead className="text-right" /></TableRow></TableHeader>
            <TableBody>
              {rows.map(({ c, h, b }) => {
                const running = s.requests.some((q) => q.clientId === c.id && q.title.startsWith("Save ") && q.status !== "Done")
                return (
                  <TableRow key={c.id}>
                    <TableCell><Link href={`/clients/${c.id}?tab=health`} className="font-medium hover:underline">{c.name}</Link><span className="block text-xs text-[var(--text-muted)]">{h.recurring ? "Monthly plan" : h.phase === "awaiting renewal" ? "Renewal undecided" : "First 90 days"}</span></TableCell>
                    <TableCell><span className="flex items-center gap-2"><span className="w-7 font-semibold tabular-nums">{h.score}</span><Pill t={LEVEL[h.level]}>{h.level}</Pill></span></TableCell>
                    <TableCell className="text-right tabular-nums">{usd(h.atStake)}{h.mrr !== h.atStake && <span className="block text-xs text-[var(--text-muted)]">billing {usd(h.mrr)} now</span>}</TableCell>
                    <TableCell className="max-w-80 whitespace-normal text-xs text-[var(--text-secondary)]">{h.signals.slice(0, 2).map((x) => x.text).join(" · ") || "Nothing worrying"}</TableCell>
                    <TableCell className="text-xs">{b.sub?.renews ? fmt(b.sub.renews) : "–"}</TableCell>
                    <TableCell className="text-right">{h.level === "At risk" && <Button size="xs" disabled={running} onClick={() => mutate((p) => savePlay(p, c, h.signals.slice(0, 3).map((x) => x.text)))}><LifeBuoy />{running ? "Save play running" : "Start save play"}</Button>}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Section>
      {r.lost.length > 0 && (
        <Section title="Lost clients" sub="Lost at renewal or cancelled later, with the same seven reasons. They leave every work list." right={<span className="flex flex-wrap gap-1.5">{reasons.map(([k, v]) => <Pill key={k} t="muted">{k} · {v}</Pill>)}</span>}>
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Left</TableHead><TableHead>How</TableHead><TableHead>Reason</TableHead><TableHead>What they said</TableHead><TableHead className="text-right">A month lost</TableHead><TableHead>Offboarded</TableHead></TableRow></TableHeader>
              <TableBody>
                {r.lost.map(({ c, how, at, reason, note }) => (
                  <TableRow key={c.id}>
                    <TableCell><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                    <TableCell className="text-xs tabular-nums">{fmt(at)}</TableCell>
                    <TableCell className="text-xs text-[var(--text-secondary)]">{how}</TableCell>
                    <TableCell>{reason}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-xs text-[var(--text-secondary)]">{note ?? "–"}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(recurringPrice(s, c))}</TableCell>
                    <TableCell className="text-xs">{c.offboardedAt ? fmt(c.offboardedAt) : <Pill t="warn">Not yet</Pill>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
      <p className="text-xs text-[var(--text-muted)]">Churn and revenue-kept history are sample figures until Stripe history is connected. Past monthly deliverables are sample until they are logged as they happen.</p>
    </>
  )
}

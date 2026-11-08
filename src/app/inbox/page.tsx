"use client"

// Inbox and outbox (v19): everything waiting on Aalpha in one list, and every message to a
// client in one log. Staff draft and queue; the client always sees Subhan as the sender.

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isOpenBug } from "@/lib/bugs"
import { alerts, openActions } from "@/lib/engine"
import { decisions, outbox } from "@/lib/onboarding"
import { isOpen } from "@/lib/requests"
import { needsYou, slackMessages } from "@/lib/slack"
import { useStore } from "@/lib/store"
import { addDays, fmt, weekStart } from "@/lib/dates"

export default function InboxPage() {
  const { s } = useStore()
  const sun = addDays(weekStart(s.today), 6)
  const items = s.clients.flatMap((c) => outbox(s, c))
  const queues = [
    { label: "Alerts", href: "/alerts", n: alerts(s).length, note: "Clients or pipeline needing a look" },
    { label: "Requests", href: "/requests", n: s.requests.filter(isOpen).length, note: "Questions, changes and report asks from clients" },
    { label: "Slack", href: "/slack", n: s.clients.flatMap((c) => slackMessages(c, s.today)).filter((m) => needsYou(s, m)).length, note: "Client channel messages to answer" },
    { label: "Onboarding", href: "/onboarding", n: decisions(s, items).length, note: "Nudges waiting for a click" },
    { label: "This week", href: "/week", n: s.clients.flatMap((c) => openActions(s, c)).filter((a) => a.due <= sun).length, note: "Delivery steps due by Sunday" },
    { label: "Bugs", href: "/bugs", n: (s.bugs ?? []).filter(isOpenBug).length, note: "Open, synced with Linear" },
  ]
  const total = queues.reduce((n, q) => n + q.n, 0)
  const name = (clientId: string) => s.clients.find((c) => c.id === clientId)?.name ?? "Unknown"
  const sent = [...s.sends].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12)
  const queued = items.filter((i) => i.status === "scheduled").slice(0, 6)

  return (
    <>
      <PageHeader title="Inbox and outbox" sub="Everything waiting on Aalpha, and every message that went to a client." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Waiting on Aalpha" value={total} note="Across every queue" t={total > 20 ? "warn" : undefined} />
        <Kpi label="Sent this month" value={s.sends.filter((x) => x.at.slice(0, 7) === s.today.slice(0, 7)).length} note="All from Subhan" />
        <Kpi label="Queued" value={queued.length} note="Scheduled onboarding messages" />
      </div>
      <Section title="Inbox" sub="Open the queue to work it">
        <div className="flex flex-col">
          {queues.map((q) => (
            <Link key={q.label} href={q.href} className="flex items-center gap-3 border-t py-3 text-sm first:border-t-0 hover:bg-[var(--surface-2)]">
              <span className="w-28 font-medium">{q.label}</span>
              <span className="flex-1 text-[var(--text-secondary)]">{q.note}</span>
              <span className="min-w-8 text-right font-semibold tabular-nums">{q.n}</span>
              <ArrowRight className="size-4 text-[var(--text-muted)]" />
            </Link>
          ))}
        </div>
      </Section>
      <Section title="Outbox" sub="Every message a client received. The sender is always Subhan; 'Drafted by' shows who on the team prepared it.">
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Message</TableHead><TableHead>From</TableHead><TableHead>Drafted by</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {queued.map((i) => <TableRow key={i.key}><TableCell className="tabular-nums">{fmt(i.due)}</TableCell><TableCell>{i.client.name}</TableCell><TableCell className="max-w-[320px] truncate">{i.text}</TableCell><TableCell>Subhan</TableCell><TableCell className="text-[var(--text-muted)]">Autopilot</TableCell><TableCell><Pill t="info">Queued</Pill></TableCell></TableRow>)}
              {sent.map((x) => <TableRow key={x.id}><TableCell className="tabular-nums">{fmt(x.at)}</TableCell><TableCell>{name(x.clientId)}</TableCell><TableCell className="max-w-[320px] truncate">{x.body}</TableCell><TableCell>Subhan</TableCell><TableCell className="text-[var(--text-muted)]">{x.by}</TableCell><TableCell><Pill t={x.status === "Sent" ? "good" : "muted"}>{x.status}</Pill></TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
      </Section>
    </>
  )
}

"use client"

// Home: one ranked feed of insight cards, shaped by who is looking (CEO, manager, staff).
// Every card comes from the catalogue; the feed only picks and orders them.

import { InsightCard } from "@/components/insight-card"
import { audienceOf, builtOn, feed, nextDepth } from "@/lib/insights"
import { MIN_TEAM, scopedView, scopeLabel, seatsInScope } from "@/lib/teams"
import { isExec } from "@/lib/setup"
import { useStore } from "@/lib/store"
import type { Client, Seat } from "@/lib/types"

type Role = "Owner" | "Manager" | "Member"

export function InsightsHome({ c, role, me, go }: { c: Client; role: Role; me: Seat; go: (tab: string) => void }) {
  const { s } = useStore()
  const aud = audienceOf(role, isExec(me))
  // Managers see their own teams, as on Overview; dollars are team totals, never a pay rate.
  const scope = role === "Manager" ? seatsInScope(c, role, me) : null
  const scoped = scope && scope.length >= MIN_TEAM ? scopedView(c, scope) : c
  const x = { c: scoped, today: s.today, me, money: role !== "Member", scoped: scoped !== c, full: c }
  const cards = feed(x, aud)
  const more = nextDepth(c, s.today)
  const lead = aud === "CEO" ? "What needs you, and what it's worth." : aud === "Manager" ? "Where your teams lose time, and what to fix first." : "Your week, and what could come off your plate."

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-[var(--text-secondary)]">{lead}</p>
        <span className="text-xs text-[var(--text-muted)]">Built on {builtOn(c, s.today)} · {cards.length} insights</span>
      </div>
      {scoped !== c && <p className="text-xs text-[var(--text-muted)]">Showing {scopeLabel(c, role, me)}. Slack numbers are company-wide.</p>}
      {cards.length === 0
        ? <div className="rounded-[var(--radius-card)] border border-dashed bg-card px-6 py-10 text-center text-sm text-[var(--text-secondary)]">Nothing to show yet. Your first insights appear once Slack is connected and a few days of work are in.</div>
        : <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">{cards.map(({ e, r }) => <InsightCard key={e.id} x={x} e={e} r={r} role={role} go={go} />)}</div>}
      {more && <p className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-secondary)]">{more}</p>}
      <p className="text-xs text-[var(--text-muted)]">Your feedback on each card goes to Subhan and tunes what you see first. Questions about a number? Ask Subhan from Get help in Settings.</p>
    </div>
  )
}

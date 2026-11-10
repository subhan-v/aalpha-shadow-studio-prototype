"use client"

// Teams (was People): one row per team with what Headroom found in its work and what the agents
// have handed back. Privacy pass 2026-11-10: owners and managers see teams, never one person's
// numbers. Each person sees their own in My work. Teams under 3 people share "Smaller teams".

import { Bot, Users } from "lucide-react"
import { Kpi } from "@/components/bits"
import { personStats } from "@/lib/people"
import { results } from "@/lib/results"
import { useStore } from "@/lib/store"
import { guarantees } from "@/lib/engine"
import { MIN_TEAM, homeTeam, seatsInScope } from "@/lib/teams"
import type { Client, Role, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`
const r1 = (n: number) => Math.round(n * 10) / 10

export function PeopleView({ c, role, me }: { c: Client; role: Role; me: Seat }) {
  const { s } = useStore()
  const money = role === "Owner"
  const scope = role === "Owner" ? c.seats : seatsInScope(c, role, me)
  const size = (name: string) => c.seats.filter((y) => homeTeam(c, y) === name).length
  const teamOf = (x: Seat) => (size(homeTeam(c, x)) < MIN_TEAM ? "Smaller teams" : homeTeam(c, x))
  const people = scope.map((x) => ({ p: personStats(c, x, s.today), team: teamOf(x) }))
  const teams = Array.from(new Set(people.map((x) => x.team)))
  const rows = teams
    .map((team) => {
      const ps = people.filter((x) => x.team === team).map((x) => x.p)
      return {
        team,
        n: ps.length,
        found: ps.reduce((n, p) => n + p.foundWk, 0),
        back: ps.reduce((n, p) => n + p.backWk, 0),
        value: ps.reduce((n, p) => n + p.valueMo, 0),
        live: new Set(ps.flatMap((p) => p.live.map((a) => a.id))).size,
      }
    })
    .sort((a, b) => b.back - a.back)
  const sum = rows.reduce((n, r) => ({ back: n.back + r.back, value: n.value + r.value, found: n.found + r.found }), { back: 0, value: 0, found: 0 })
  // The whole company's totals come from Results, so the two pages always agree.
  const res = results(c, s.today)
  const tot = role === "Owner" ? { back: res.time.hrsWk, value: res.money.valueMo, found: guarantees(c, s.today).found } : sum
  const cols = money ? "grid-cols-[minmax(160px,1.6fr)_70px_100px_90px_100px_110px]" : "grid-cols-[minmax(160px,1.6fr)_70px_100px_90px_100px]"
  return (
    <div data-tour="people" className="flex flex-col gap-4">
      <p className="text-sm text-[var(--text-secondary)]">{role === "Owner" ? "Every team" : `Your teams: ${teams.join(", ")}`}. Hours handed back, by team. Each person sees their own numbers in My work, and nobody else does.</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<Users />} hue="#2a78d6" label="Teams" value={rows.length} note={`${people.length} people`} />
        <Kpi icon={<Bot />} hue="#6250d6" label="Hours back a week" value={r1(tot.back)} note={`of ${Math.round(tot.found)} h found`} />
        {money && <Kpi icon={<Bot />} hue="#1baf7a" label="Value back a month" value={usd(tot.value)} note="At payroll rates, by team" />}
      </div>
      <section className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className={cn("grid gap-3 border-b px-5 py-2.5 text-xs text-[var(--text-muted)]", cols)}>
              <span>Team</span><span className="text-right">People</span><span className="text-right">Found h/wk</span><span className="text-right">Agents live</span><span className="text-right">Back h/wk</span>{money && <span className="text-right">Value / mo</span>}
            </div>
            {rows.map((r) => (
              <div key={r.team} className={cn("grid items-center gap-3 border-b px-5 py-3.5 text-sm last:border-b-0", cols)}>
                <span className="truncate font-medium">{r.team}</span>
                <span className="text-right tabular-nums text-[var(--text-secondary)]">{r.n}</span>
                <span className="text-right tabular-nums">{r1(r.found)}</span>
                <span className="text-right tabular-nums">{r.live}</span>
                <span className="text-right font-semibold tabular-nums">{r1(r.back)}</span>
                {money && <span className="text-right tabular-nums text-[var(--delta-good)]">{usd(r.value)}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>
      <p className="text-xs text-[var(--text-muted)]">Teams with fewer than {MIN_TEAM} people are shown together, so no row can point at one person.</p>
    </div>
  )
}

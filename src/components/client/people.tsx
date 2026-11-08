"use client"

// People: one row per person with what Shadow found in their work and what the agents have
// handed back to them. This is time given back, never a productivity score. Owners see
// everyone with dollars; managers see their own team, hours only.

import { useState } from "react"
import { Bot, ChevronRight, Users } from "lucide-react"
import { CatBubble, Kpi, Pill, Shown } from "@/components/bits"
import { band } from "@/components/fit-chart"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WK_TO_MO } from "@/lib/client-data"
import { personStats } from "@/lib/people"
import { results } from "@/lib/results"
import { useStore } from "@/lib/store"
import { guarantees } from "@/lib/engine"
import { slackOf } from "@/lib/setup"
import { SlackAvatar, SlackBadge } from "./avatar"
import { MIN_TEAM, homeTeam, seatsInScope } from "@/lib/teams"
import type { Client, Role, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

export function PeopleView({ c, role, me }: { c: Client; role: Role; me: Seat }) {
  const { s } = useStore()
  const money = role === "Owner"
  const scope = role === "Owner" ? c.seats : seatsInScope(c, role, me)
  // Teams under 3 people share one "Smaller teams" filter, the same rule as every team view.
  const size = (name: string) => c.seats.filter((y) => homeTeam(c, y) === name).length
  const teamOf = (x: Seat) => (size(homeTeam(c, x)) < MIN_TEAM ? "Smaller teams" : homeTeam(c, x))
  const teams = Array.from(new Set(scope.map(teamOf)))
  const [team, setTeam] = useState("All")
  const [sel, setSel] = useState<string | null>(null)
  const rows = scope.map((x) => ({ x, p: personStats(c, x, s.today), team: teamOf(x) })).filter((r) => team === "All" || r.team === team).sort((a, b) => b.p.backWk - a.p.backWk)
  const sum = rows.reduce((n, r) => ({ back: n.back + r.p.backWk, value: n.value + r.p.valueMo, found: n.found + r.p.foundWk }), { back: 0, value: 0, found: 0 })
  // The whole team's totals come from Results, so the two pages always agree; per-person rows are estimates.
  const r = results(c, s.today)
  const tot = role === "Owner" && team === "All" ? { back: r.time.hrsWk, value: r.money.valueMo, found: guarantees(c, s.today).found } : sum
  const open = rows.find((r) => r.x.id === sel)
  return (
    <div data-tour="people" className="flex flex-col gap-4">
      <p className="text-sm text-[var(--text-secondary)]">{role === "Owner" ? "Everyone on the team" : `Your teams: ${teams.join(", ")}`}. This shows hours handed back to each person.</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<Users />} hue="#2a78d6" label="People" value={rows.length} note={team === "All" ? `${teams.length} ${teams.length === 1 ? "team" : "teams"}` : team} />
        <Kpi icon={<Bot />} hue="#6250d6" label="Hours back a week" value={Math.round(tot.back * 10) / 10} note={`of ${Math.round(tot.found)} h found`} />
        {money && <Kpi icon={<Bot />} hue="#1baf7a" label="Value back a month" value={usd(tot.value)} note="At each person's payroll rate" />}
      </div>
      {teams.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Team">
          {["All", ...teams].map((t) => <button key={t} aria-pressed={team === t} onClick={() => setTeam(t)} className={cn("h-8 rounded-full border px-3 text-sm", team === t ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "bg-card text-[var(--text-secondary)]")}>{t}</button>)}
        </div>
      )}
      <section className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className={cn("grid gap-3 border-b px-5 py-2.5 text-xs text-[var(--text-muted)]", money ? "grid-cols-[minmax(180px,1.6fr)_minmax(120px,1fr)_60px_90px_70px_90px_100px_20px]" : "grid-cols-[minmax(180px,1.6fr)_minmax(120px,1fr)_60px_90px_70px_90px_20px]")}>
              <span>Person</span><span>Team</span><span className="text-right">Fit</span><span className="text-right">Found h/wk</span><span className="text-right">Agents</span><span className="text-right">Back h/wk</span>{money && <span className="text-right">Value / mo</span>}<span />
            </div>
            {rows.map(({ x, p, team: t }) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={cn("grid w-full items-center gap-3 border-b px-5 py-3 text-left text-sm last:border-b-0 hover:bg-[var(--surface-2)]", money ? "grid-cols-[minmax(180px,1.6fr)_minmax(120px,1fr)_60px_90px_70px_90px_100px_20px]" : "grid-cols-[minmax(180px,1.6fr)_minmax(120px,1fr)_60px_90px_70px_90px_20px]")}>
                <span className="flex min-w-0 items-center gap-2.5"><SlackAvatar c={c} s={x} /><span className="flex min-w-0 flex-col"><span className="truncate font-medium">{x.name}</span><span className="truncate text-xs text-[var(--text-muted)]">@{slackOf(c, x).handle} · {x.role}</span></span></span>
                <span className="truncate text-[var(--text-secondary)]">{t}</span>
                <span className="text-right"><span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums", band(p.fit?.fit ?? null).cls)}>{p.fit?.fit ?? "–"}</span></span>
                <span className="text-right tabular-nums">{p.foundWk}</span>
                <span className="text-right tabular-nums">{p.live.length}</span>
                <span className="text-right font-semibold tabular-nums">{p.backWk}</span>
                {money && <span className="text-right tabular-nums text-[var(--delta-good)]">{usd(p.valueMo)}</span>}
                <ChevronRight className="size-4 text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <Sheet open={!!open} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="right" className="gap-0 bg-[var(--page)] data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {open && (
            <>
              <SheetHeader className="border-b bg-card">
                <SheetTitle className="text-lg font-semibold">{open.x.name}</SheetTitle>
                <SheetDescription className="text-xs">{open.x.role} · {open.team} · {open.p.status}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 overflow-auto p-4">
                <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                  <SlackAvatar c={c} s={open.x} size={48} />
                  <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{slackOf(c, open.x).display}</span><span className="text-xs text-[var(--text-muted)]">@{slackOf(c, open.x).handle} · {slackOf(c, open.x).email}</span></span>
                  <SlackBadge />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[[`${open.p.foundWk} h`, "found a week"], [`${open.p.backWk} h`, "back a week"], money ? [usd(open.p.valueMo), "back a month"] : [`${Math.round(open.p.backWk * WK_TO_MO)} h`, "back a month"]].map(([v, k]) => <div key={k} className="rounded-2xl border bg-card p-3"><div className="text-xl font-semibold tabular-nums">{v}</div><div className="text-xs text-[var(--text-muted)]">{k}</div></div>)}
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <div className="mb-2 text-xs text-[var(--text-muted)]">Agents working for them</div>
                  {open.p.agents.length === 0 && <p className="text-sm text-[var(--text-muted)]">None planned for this role yet.</p>}
                  {open.p.agents.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 border-t py-2 text-sm first:border-t-0"><span className="flex items-center gap-2"><Bot className="size-4 text-[var(--text-muted)]" />{a.name}</span><Pill t={open.p.live.includes(a) ? "good" : "muted"}>{open.p.live.includes(a) ? "Live" : "Coming"}</Pill></div>)}
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <div className="mb-2 text-xs text-[var(--text-muted)]">Repeat work in their role</div>
                  {open.p.workflows.slice(0, 6).map((w) => <div key={w.id} className="flex items-center justify-between gap-2 border-t py-2 text-sm first:border-t-0"><span className="truncate">{w.name}</span><CatBubble c={w.category} /></div>)}
                  <Shown n={6} of={open.p.workflows.length} hint="Workflows has the full list." />
                  {open.p.workflows.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nothing repeatable found for this role.</p>}
                </div>
                {open.p.fit && <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm"><span className={cn("grid size-10 place-items-center rounded-xl font-semibold tabular-nums", band(open.p.fit.fit).cls)}>{open.p.fit.fit ?? "–"}</span><span>{band(open.p.fit.fit).word}{open.p.fit.profile ? ` · ${open.p.fit.profile}` : ""}. Full profile in the Fit Map.</span></div>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

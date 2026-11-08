"use client"

// Team: who is recording, who isn't and why, by team, with one-click follow-up. Owners see
// every team, managers their own; Studio sees the same view. Status only, never content.
// Owner nudges go out in the owner's name; the automated ones stay from Subhan.

import { useState } from "react"
import { AlertTriangle, Clock, MessageSquare, Search, Send, Users } from "lucide-react"
import { Kpi, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { scheduleFor } from "@/lib/client-data"
import { fmt } from "@/lib/dates"
import { captured, nudge, nudgedRecently, recStatus, STATUS_ORDER, timeline, type RecStatus } from "@/lib/recording"
import { useStore } from "@/lib/store"
import { onboardingSteps, slackOf, userGroup } from "@/lib/setup"
import { SlackAvatar } from "./avatar"
import { displayTeams, homeTeam, seatsInScope, suggestFunction, teamsOf } from "@/lib/teams"
import type { Client, Role, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

const TONE: Record<RecStatus, "good" | "warn" | "bad" | "muted" | "info"> = {
  Recording: "good", Paused: "info", "No consent": "warn", "Quiet 3+ days": "bad", "Permissions missing": "warn", "Not installed": "warn", "Invited, not joined": "warn", "On leave": "muted", Excluded: "muted",
}
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const presetOf247 = (k: { preset?: string; days: number[]; start: string }) => k.preset === "247" || (k.days.length === 7 && k.start === "00:00")

export function RosterView({ c, role, me }: { c: Client; role: Role | "Admin"; me?: Seat }) {
  const { s, mutate, update } = useStore()
  const t = s.today
  const viewer = me ?? c.seats[0]
  const sender = role === "Admin" ? "Subhan" : viewer.name
  const seats = role === "Admin" || role === "Owner" ? c.seats : seatsInScope(c, role, viewer)
  const rows = seats.map((x) => ({ seat: x, team: homeTeam(c, x), ...recStatus(c, x, t) }))
  const [team, setTeam] = useState("all")
  const [status, setStatus] = useState("all")
  const [q, setQ] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const visTeams = teamsOf(c).filter((x) => seats.some((y) => homeTeam(c, y) === x.name))
  const shown = rows.filter((r) => (team === "all" || r.team === team) && (status === "all" || (status === "attention" ? r.attention : r.status === status)) && (!q || r.seat.name.toLowerCase().includes(q.toLowerCase())))
  const attention = rows.filter((r) => r.attention)
  const active = rows.filter((r) => !r.seat.away)
  const rec = active.filter((r) => r.status === "Recording" || r.status === "Paused").length
  const cap = captured(c, seats, t)
  const disp = displayTeams(visTeams.map((x) => ({ ...x, seats: x.seats.filter((y) => seats.includes(y)) })))
  const digest = [...disp.big.map((x) => ({ name: x.name, seats: x.seats })), ...(disp.rolled ? [disp.rolled] : [])].map((g) => {
    const r = rows.filter((x) => g.seats.includes(x.seat) && !x.seat.away)
    const n = r.filter((x) => x.status === "Recording" || x.status === "Paused").length
    const bad = r.find((x) => x.attention)
    return `${n} of ${r.length} in ${g.name} recording${bad ? `. ${bad.seat.name.split(" ")[0]}: ${bad.status.toLowerCase()}${bad.since ? ` since ${fmt(bad.since)}` : ""}` : ""}.`
  })
  const setup = (x: Seat) => { const st = onboardingSteps(c, x, (c.access[x.id] ?? "Member") as Role, t); return { done: st.filter((y) => y.done).length, total: st.length } }
  // Teams under 3 people are listed together, so no team is a list of one or two named people.
  const groups = [...disp.big.map((x) => ({ name: x.name, lead: x.lead, has: (t: string) => t === x.name })), ...(disp.small.length ? [{ name: "Smaller teams", lead: null, has: (t: string) => disp.small.some((y) => y.name === t) }] : [])]
  const sameStep = status !== "all" && status !== "attention" ? shown.filter((r) => r.attention && !nudgedRecently(s, c, r.seat.id)) : []

  if (!c.teamsConfirmed && role !== "Member") return <ConfirmTeams c={c} canConfirm={role === "Owner" || role === "Admin"} />

  return (
    <div data-tour="roster" className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<Clock />} hue="#2a78d6" label="Working hours captured" value={`${cap.pct}%`} note="Last 7 days, against each person's own hours" />
        <Kpi icon={<Users />} hue="#1baf7a" label="Recording" value={`${rec} of ${active.length}`} note="Paused counts as recording" />
        <Kpi icon={<AlertTriangle />} hue="#e5484d" label="Need attention" value={attention.length} t={attention.length ? "bad" : undefined} note={attention.length ? attention.map((r) => r.seat.name.split(" ")[0]).slice(0, 3).join(", ") : "Nobody"} />
        <Kpi icon={<Users />} hue="#687182" label="On leave or left out" value={rows.length - active.length} note="Not counted above" />
      </div>

      {attention.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--status-warning)] bg-[var(--watch-bg)] px-4 py-3 text-sm text-[var(--watch-fg)]">
          <AlertTriangle className="size-4" />
          <span className="flex-1">{attention.length} {attention.length === 1 ? "person needs" : "people need"} a nudge to get recording again.</span>
          <Button size="sm" variant="outline" className="rounded-[10px] bg-card" onClick={() => { setStatus("attention"); setTeam("all") }}>See who needs help</Button>
        </div>
      )}

      <Section title="By team" sub="Captured hours and who is recording. Teams under 3 people roll up so nobody is shown alone.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {disp.big.map((x) => {
            const r = rows.filter((y) => x.seats.includes(y.seat) && !y.seat.away)
            const n = r.filter((y) => y.status === "Recording" || y.status === "Paused").length
            const pct = captured(c, x.seats, t).pct
            return (
              <button key={x.name} onClick={() => { setTeam(x.name); setStatus("all") }} className={cn("flex flex-col gap-2 rounded-2xl border p-4 text-left hover:border-[var(--seq-500)]", team === x.name && "border-[var(--graphite)]")}>
                <span className="flex items-center justify-between gap-2"><span className="font-semibold">{x.name}</span><span className="text-xs text-[var(--text-muted)]">{x.kind === "pod" ? "Pod" : "Team"}</span></span>
                <span className="text-xs text-[var(--text-muted)]">Lead: {x.lead?.name ?? "not set"}</span>
                <span className="flex items-baseline justify-between"><span className="text-2xl font-semibold tabular-nums">{pct}%</span><span className="text-sm tabular-nums text-[var(--text-secondary)]">{n} of {r.length} recording</span></span>
                <span className="h-1.5 rounded-full bg-[var(--surface-2)]"><span className="block h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct >= 85 ? "var(--status-good)" : "var(--status-warning)" }} /></span>
              </button>
            )
          })}
          {disp.rolled && <div className="flex flex-col gap-1 rounded-2xl border border-dashed p-4 text-sm"><span className="font-semibold">{disp.rolled.name}</span><span className="text-[var(--text-secondary)]">{disp.rolled.seats.length} people in teams under 3. Counted in the totals, not shown on their own.</span></div>}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={team} onValueChange={(v) => v && setTeam(String(v))}>
          <SelectTrigger aria-label="Team" className="h-9 min-w-44 rounded-xl bg-card"><span className="flex-1 text-left text-sm">{team === "all" ? "All teams" : team}</span></SelectTrigger>
          <SelectContent><SelectItem value="all">All teams</SelectItem>{visTeams.map((x) => <SelectItem key={x.name} value={x.name}>{x.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => v && setStatus(String(v))}>
          <SelectTrigger aria-label="Status" className="h-9 min-w-44 rounded-xl bg-card"><span className="flex-1 text-left text-sm">{status === "all" ? "Any status" : status === "attention" ? "Needs attention" : status}</span></SelectTrigger>
          <SelectContent><SelectItem value="all">Any status</SelectItem><SelectItem value="attention">Needs attention</SelectItem>{STATUS_ORDER.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        <label className="relative flex-1 min-w-48"><Search className="absolute top-2.5 left-3 size-4 text-[var(--text-muted)]" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="h-9 rounded-xl bg-card pl-9" /></label>
        {sameStep.length > 1 && <Button size="sm" className="rounded-[10px]" onClick={() => mutate((p) => nudge(p, c, sameStep, sender))}><Send />Nudge all {sameStep.length} at this step</Button>}
      </div>

      <section className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
        {shown.length === 0 && <p className="p-5 text-sm text-[var(--text-muted)]">Nobody matches.</p>}
        {groups.filter((x) => shown.some((r) => x.has(r.team))).map((x) => (
          <div key={x.name}>
            <div className="flex items-center justify-between gap-2 border-b bg-[var(--surface-2)] px-5 py-2 text-xs text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{x.name}</span>{x.lead && <span>Lead: {x.lead.name}</span>}</div>
            {shown.filter((r) => x.has(r.team)).map((r) => {
              const tl = timeline(s, c, r.seat.id)
              const recent = nudgedRecently(s, c, r.seat.id)
              const sc = scheduleFor(c, r.seat.id)
              return (
                <div key={r.seat.id} className="border-b last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="flex min-w-44 flex-1 items-center gap-2.5"><SlackAvatar c={c} s={r.seat} /><span className="flex min-w-0 flex-col"><span className="font-medium">{r.seat.name} <span className="text-xs font-normal text-[var(--text-muted)]">@{slackOf(c, r.seat).handle}</span></span><span className="text-xs text-[var(--text-muted)]">{r.seat.role} · {presetOf247(sc) ? "24/7" : `${sc.days.map((d) => DAYS[d - 1]).join(" ")} ${sc.start} to ${sc.end}`}</span></span></span>
                    <span className="flex flex-col text-xs text-[var(--text-muted)]"><span>Setup {setup(r.seat).done} of {setup(r.seat).total}</span><span>{r.seat.interview ? (r.seat.interview.mapped ? `Interview: ${r.seat.interview.mapped.workflows} verified, ${r.seat.interview.mapped.handoffs} hand-offs` : "Interview done") : "Interview to do"}</span></span>
                    <span className="flex flex-col items-start gap-0.5"><Pill t={r.attention ? "bad" : TONE[r.status]}>{r.status}</Pill>{r.since && r.status !== "Recording" && <span className="text-xs text-[var(--text-muted)]">since {fmt(r.since)}</span>}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.attention && <Button size="xs" disabled={recent} onClick={() => mutate((p) => nudge(p, c, [r], sender))}><Send />{recent ? "Nudged" : "Nudge"}</Button>}
                      <Button size="xs" variant="ghost" aria-label={`Messages sent to ${r.seat.name}`} onClick={() => setOpen(open === r.seat.id ? null : r.seat.id)}><MessageSquare />{tl.length} {tl.length === 1 ? "message" : "messages"}</Button>
                      {role !== "Member" && (r.seat.away
                        ? <Button size="xs" variant="ghost" onClick={() => update(c.id, (y, d) => ({ ...y, seats: y.seats.map((z) => (z.id === r.seat.id ? { ...z, away: null } : z)), log: [{ date: d, text: `${r.seat.name} back in recording follow-up.` }, ...y.log] }))}>Back</Button>
                        : <>
                            <Button size="xs" variant="ghost" onClick={() => update(c.id, (y, d) => ({ ...y, seats: y.seats.map((z) => (z.id === r.seat.id ? { ...z, away: "leave" } : z)), log: [{ date: d, text: `${r.seat.name} marked on leave by ${sender}.` }, ...y.log] }))}>On leave</Button>
                            <Button size="xs" variant="ghost" onClick={() => update(c.id, (y, d) => ({ ...y, seats: y.seats.map((z) => (z.id === r.seat.id ? { ...z, away: "excluded" } : z)), log: [{ date: d, text: `${r.seat.name} left out of recording by ${sender}.` }, ...y.log] }))}>Exclude</Button>
                          </>)}
                    </span>
                  </div>
                  {open === r.seat.id && (
                    <div className="flex flex-col gap-2 bg-[var(--surface-2)] px-5 py-3 text-sm">
                      <span className="text-xs text-[var(--text-muted)]">Messages sent to {r.seat.name.split(" ")[0]}</span>
                      {tl.length === 0 && <span className="text-xs text-[var(--text-muted)]">Nothing sent yet.</span>}
                      {tl.map((m) => <div key={m.id} className="rounded-xl bg-card p-2.5"><span className="text-xs text-[var(--text-muted)]">{fmt(m.at)} · from {m.by}{m.stepId.startsWith("owner:") ? "" : " (automated)"}</span><p>{m.body}</p></div>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </section>

      <Section title="Your Monday digest" sub="A preview of what lands in your Slack each week">
        <div className="rounded-2xl bg-[var(--surface-2)] p-4 text-sm leading-relaxed">
          <span className="font-semibold">{APP} · weekly recording check</span>
          <p className="mt-1 text-[var(--text-secondary)]">{cap.pct}% of the team&apos;s working hours captured last week. {rec} of {active.length} recording.</p>
          <ul className="mt-2 flex flex-col gap-1">{digest.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      </Section>
      <p className="text-xs text-[var(--text-muted)]">Status only. This page never shows what anyone was working on.</p>
    </div>
  )
}

/** Kickoff: Shadow suggests teams from job titles and the Fit Map; the owner confirms in one step. */
function ConfirmTeams({ c, canConfirm }: { c: Client; canConfirm: boolean }) {
  const { update } = useStore()
  const groups = Array.from(new Set(c.seats.map((x) => x.team ?? suggestFunction(x.role))))
  return (
    <Section title="Confirm your teams" sub="Suggested from your Slack user groups, job titles and the Culture Intelligence Fit Map. Every person gets one home team.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const people = c.seats.filter((x) => (x.team ?? suggestFunction(x.role)) === g)
          return <div key={g} className="rounded-2xl border p-4"><div className="flex justify-between gap-2"><span className="font-semibold">{g}</span><span className="text-xs text-[var(--text-muted)]">{people.length} people</span></div><span className="font-mono text-xs text-[var(--text-muted)]">Slack {userGroup(g)}</span><p className="mt-1 text-xs text-[var(--text-secondary)]">{people.map((x) => x.name.split(" ")[0]).join(", ")}</p></div>
        })}
      </div>
      {canConfirm ? <Button className="mt-4 rounded-[10px]" onClick={() => update(c.id, (x, t) => ({ ...x, seats: x.seats.map((y) => ({ ...y, team: y.team ?? suggestFunction(y.role) })), teamsConfirmed: t, log: [{ date: t, text: "Teams confirmed." }, ...x.log] }))}>Confirm teams</Button> : <p className="mt-4 text-sm text-[var(--text-muted)]">The account owner confirms the teams.</p>}
    </Section>
  )
}


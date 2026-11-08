"use client"

// Executive report: one page for anyone flagged Executive, in place of My time. Their own week
// (and where it goes against this company versus other work), the company at a glance, the top
// opportunity in each team, risks, the decisions waiting on them, and a one-click report. The
// owner can open every executive's report; an executive sees only their own.

import { useState } from "react"
import { AlertTriangle, Bot, Building2, Clock, FileDown, Hourglass, Moon, Timer } from "lucide-react"
import { Kpi, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { valueMo } from "@/lib/client-data"
import { fmt } from "@/lib/dates"
import { agentStatus, guarantees, visibleWorkflows } from "@/lib/engine"
import { captured, recStatus } from "@/lib/recording"
import { results } from "@/lib/results"
import { isExec } from "@/lib/setup"
import { useStore } from "@/lib/store"
import { displayTeams, teamShare, teamsOf } from "@/lib/teams"
import { download } from "@/lib/workbook"
import { MyTimeTab, myData } from "./mytime"
import { execWeek, handOffWk } from "@/lib/people"
import type { Client, Role, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Empty } from "./home"

const C = ["#2a78d6", "#eb6834", "#eda100", "#1baf7a", "#6250d6", "#c3c8d2", "#e87ba4"]

export function ExecView({ c, role, me }: { c: Client; role: Role; me: Seat }) {
  const { s, update } = useStore()
  const execs = role === "Owner" ? c.seats.filter((x) => isExec(x) || x.id === c.seats[0].id) : c.seats.filter((x) => x.id === me.id && isExec(x))
  const [who, setWho] = useState(execs[0]?.id ?? "")
  const [made, setMade] = useState(false)
  const p = execs.find((x) => x.id === who) ?? execs[0]
  if (!p) return <Empty title="For leadership only" body="The Executive report shows for anyone marked as an executive in Settings." />
  const w = execWeek(c, p, myData(c, p).hours)
  const handOff = handOffWk(c, p, s.today)
  const isOwner = p.id === c.seats[0].id
  const value = isOwner && c.business ? c.business.ownerValue : null
  const t = s.today
  const g = guarantees(c, t)
  const r = results(c, t)
  const cov = captured(c, c.seats, t)
  const money = role === "Owner"
  const vis = visibleWorkflows(c, t)
  const byTeam = displayTeams(teamsOf(c)).big.map((tm) => {
    const best = [...vis].map((w) => ({ w, v: valueMo(c, w.hoursWk * teamShare(c, w, tm.name), w.category), h: w.hoursWk * teamShare(c, w, tm.name) })).filter((x) => x.h > 0).sort((a, b) => b.v - a.v)[0]
    return { team: tm.name, best }
  }).filter((x) => x.best).sort((a, b) => b.best!.v - a.best!.v)
  const attention = c.seats.filter((x) => recStatus(c, x, t).attention).length
  const key = c.seats.find((x) => x.id === c.fit.find((f) => f.keyPerson)?.seatId)
  const pains = c.seats.filter((x) => x.interview?.pains?.length).flatMap((x) => x.interview!.pains!.map((pn) => ({ pn, who: x.name.split(" ")[0] })))
  const painLines = Array.from(new Map(pains.map((x) => [x.pn, x])).values()).slice(0, 3).map((x) => `${x.pn} (from ${x.who}'s interview)`)
  // Client-facing risks only: Aalpha's own checks (requirements, agent spec) stay in Studio.
  const risks = [...painLines, ...(attention ? [`${attention} people not recording as they should`] : []), ...(key ? [key.id === p.id ? "Key person: a lot of work runs through you" : `Key person: a lot of work runs through ${key.name}`] : [])]
  const proposed = c.agents.filter((a) => agentStatus(a, c, t) === "proposed")
  const decisions = [
    ...(proposed.length ? [`Approve the next ${Math.min(3, proposed.length)} agents: ${proposed.slice(0, 3).map((a) => a.name).join(", ")}`] : []),
    ...(c.goalLock?.pending ? ["A goal change is waiting on Aalpha"] : []),
    `${w.approvalsWaiting} approvals and replies are waiting on ${p.name.split(" ")[0]} right now`,
  ]
  const makeReport = () => {
    const md = [`# Executive report, ${p.name}`, "", `Week of ${t}`, "", `- ${w.hours} hours this week, ${w.thisCo}% on ${c.name}`, `- ${handOff} h/wk of their repeat work could be handed off`, `- ${g.found} h/wk found, ${r.time.hrsWk} h/wk back${money ? `, worth $${Math.round(r.money.valueMo).toLocaleString()} a month` : ""}`, `- ${cov.pct}% of working hours captured`, "", "## Decisions waiting", ...decisions.map((d) => `- ${d}`), "", "## Risks", ...(risks.length ? risks.map((x) => `- ${x}`) : ["- None"])].join("\n")
    update(c.id, (x, d) => ({ ...x, reports: [{ id: `${x.id}-ceo-${Date.now()}`, kind: "ceo", title: `Executive report, ${p.name}`, period: `Week of ${fmt(d)}`, status: "sent", created: d, sent: d, summary: `${w.hours} hours this week, ${w.thisCo}% on ${x.name}. ${r.time.hrsWk} h/wk back. ${decisions.length} decisions waiting.` }, ...x.reports], log: [{ date: d, text: `Executive report created for ${p.name}.` }, ...x.log] }))
    download(`executive-report-${p.name.toLowerCase().replace(/[^a-z]+/g, "-")}.md`, md, "text/markdown")
    setMade(true)
  }
  return (
    <div data-tour="exec" className="flex flex-col gap-5">
      {execs.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Executive">
          {execs.map((x) => <button key={x.id} aria-pressed={x.id === p.id} onClick={() => setWho(x.id)} className={cn("h-9 rounded-full border px-3.5 text-sm", x.id === p.id ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "bg-card text-[var(--text-secondary)]")}>{x.name} · {x.role}</button>)}
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<Clock />} hue="#2a78d6" label="Hours this week" value={w.hours} note="Across every source Shadow sees" />
        <Kpi icon={<Building2 />} hue="#1baf7a" label={`On ${c.name}`} value={`${w.thisCo}%`} note={w.otherCo ? `${w.otherCo}% on other work` : "All of it"} />
        <Kpi icon={<Timer />} hue="#6250d6" label="Deep focus" value={`${w.focus.hours} h`} note={`Blocks of 25 min or more · longest ${w.focus.longestMin} min`} />
        <Kpi icon={<Hourglass />} hue="#eb6834" label="Waiting on them" value={w.approvalsWaiting} note="Approvals and replies right now" t={w.approvalsWaiting > 8 ? "warn" : undefined} />
        <Kpi icon={<Moon />} hue="#eda100" label="After hours" value={`${w.afterHoursPct}%`} note="Of active time outside set hours" />
        <Kpi icon={<Bot />} hue="#e87ba4" label="Asks to agents" value={w.agentAsks} note="This week" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title="Where the week goes" sub={`${p.name}, ${w.hours} hours`}>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">{w.rows.map((r, i) => <span key={r.name} title={`${r.name}: ${r.hours} h`} style={{ width: `${r.share * 100}%`, background: "otherCo" in r ? "#e5484d" : C[i % C.length] }} />)}</div>
          <div className="mt-4 flex flex-col">
            {w.rows.map((r, i) => (
              <div key={r.name} className="grid grid-cols-[14px_minmax(0,1fr)_56px_44px] items-center gap-3 border-t py-2 text-sm first:border-t-0">
                <span className="size-2.5 rounded-full" style={{ background: "otherCo" in r ? "#e5484d" : C[i % C.length] }} />
                <span className="truncate">{r.name}{"otherCo" in r && <span className="ml-2 text-xs text-[var(--delta-bad)]">other company</span>}</span>
                <span className="text-right font-semibold tabular-nums">{r.hours} h</span>
                <span className="text-right text-xs tabular-nums text-[var(--text-muted)]">{Math.round(r.share * 100)}%</span>
              </div>
            ))}
          </div>
        </Section>
        <div className="flex flex-col gap-5">
          <Section title="Could be handed off" sub="Their share of the repeat work in their role">
            <div className="text-4xl font-semibold tracking-[-0.03em] tabular-nums">{handOff}<span className="text-lg text-[var(--text-muted)]"> h/wk</span></div>
            {value ? <p className="mt-2 text-sm text-[var(--text-secondary)]">At the ${value}/h you put on your own time, that&apos;s <b className="text-[var(--text-primary)]">${Math.round(handOff * value).toLocaleString()} a week</b> of founder time on work someone else or an agent could do.</p>
              : <p className="mt-2 text-sm text-[var(--text-secondary)]">{handOff ? "Work that could move to the team or to an agent." : "No repeat workflows found in this role yet. Approvals waiting on them show under Decisions."}</p>}
          </Section>
          <Section title="Share of time in meetings" sub="Last 6 weeks">
            <div className="flex h-24 items-end gap-2 border-b">{w.trend.map((v, i) => <div key={i} className="flex h-full flex-1 items-end"><div className="w-full rounded-t-[4px] bg-[var(--bronze)]" style={{ height: `${(v / 40) * 100}%` }} title={`Week ${i + 1}: ${v}%`} /></div>)}</div>
            <div className="mt-1.5 flex justify-between text-xs text-[var(--text-muted)]"><span>{w.trend[0]}%</span><span>{w.trend[w.trend.length - 1]}% now</span></div>
          </Section>
        </div>
      </div>
      <Section title="The company at a glance" sub={`${c.name}, this week`} right={made ? <span className="text-sm text-[var(--delta-good)]">Saved to Reports and downloaded as a text file.</span> : <Button size="sm" className="rounded-[10px]" onClick={makeReport}><FileDown />Create this week&apos;s report</Button>}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {[[`${g.found} h/wk`, "Found"], [`${r.time.hrsWk} h/wk`, "Back"], ...(money ? [[`$${Math.round(r.money.valueMo).toLocaleString()}`, "Value back a month"]] : []), [`${cov.pct}%`, "Working hours captured"]].map(([v, k]) => <div key={k} className="rounded-2xl bg-[var(--surface-2)] p-3"><div className="text-xl font-semibold tabular-nums">{v}</div><div className="text-xs text-[var(--text-muted)]">{k}</div></div>)}
        </div>
      </Section>
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Top opportunity by team" sub="Biggest by value a month">
          {byTeam.map(({ team, best }) => <div key={team} className="flex items-center justify-between gap-3 border-t py-2 text-sm first:border-t-0"><span className="flex min-w-0 flex-col"><span className="truncate font-medium">{best!.w.name}</span><span className="text-xs text-[var(--text-muted)]">{team}</span></span><span className="shrink-0 font-semibold tabular-nums text-[var(--delta-good)]">{money ? `$${Math.round(best!.v).toLocaleString()}` : `${Math.round(best!.h * 4.33)} h`}</span></div>)}
        </Section>
        <Section title="Decisions waiting on you" sub="Agents to approve, goal changes and replies">
          <ul className="flex flex-col gap-2 text-sm">{decisions.map((d) => <li key={d} className="flex gap-2"><Hourglass className="mt-0.5 size-3.5 shrink-0 text-[var(--watch-fg)]" />{d}</li>)}</ul>
        </Section>
        <Section title="Risks" sub={risks.length ? `${risks.length} to watch` : "Nothing to watch"}>
          <ul className="flex flex-col gap-2 text-sm">{risks.map((x) => <li key={x} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--delta-bad)]" />{x}</li>)}</ul>
          {risks.length === 0 && <p className="text-sm text-[var(--text-muted)]">On track.</p>}
        </Section>
      </div>
      {p.id === me.id && (
        <details className="group rounded-[var(--radius-card)] border bg-card p-5">
          <summary className="cursor-pointer text-lg">Your time, in detail</summary>
          <div className="mt-4"><MyTimeTab c={c} me={p} money={role === "Owner"} /></div>
        </details>
      )}
      {w.otherCo > 0 && <p className="text-xs text-[var(--text-muted)]">Other company time comes from the sources tagged in the Business profile ({c.business!.otherCompanies[0].sources.join(", ")}). Only the total shows here.</p>}
    </div>
  )
}

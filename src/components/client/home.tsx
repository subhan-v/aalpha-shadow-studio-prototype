"use client"

// Team: the owner's home (audit 3.3, insights ranked per 3.5), plus what Mina asked
// for on the Oct 14 call: dollars from payroll, plain metric names, before vs
// after, and a filter by team member. Every headline number opens its rows.

import { useState } from "react"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, DollarSign, Link2, Plus, Radio, Target, Users } from "lucide-react"
import { CatBubble, Kpi, Section } from "@/components/bits"
import { RowsSheet } from "@/components/rows-sheet"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { beforeAfter, byCategory, handoffs, MIX, rateFor, responseTime, slackAsks, teamStats, valueMo, WK_TO_MO } from "@/lib/client-data"
import { fmt, weekday } from "@/lib/dates"
import { dayN, visibleWorkflows } from "@/lib/engine"
import { goalFocus, tunedScore } from "@/lib/goals"
import { useStore } from "@/lib/store"
import { recordingNow } from "@/lib/recording"
import { scopedView } from "@/lib/teams"
import type { Client, Pilot, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"

const TIER_C = { H: "#1c5cab", M: "#3987e5", L: "#86b6ef" }
const MIX_C = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6", "#c3c8d2"]
const money = (n: number) => `$${Math.round(n).toLocaleString()}`

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed bg-card px-6 py-14 text-center">
      <span className="text-lg font-semibold">{title}</span>
      <span className="max-w-md text-sm text-[var(--text-secondary)]">{body}</span>
    </div>
  )
}

export function HomeTab({ c: full, go, rates = true, people = true, scope }: { c: Client; go: (tab: string, extra?: string) => void; rates?: boolean; people?: boolean; scope?: { seats: Seat[]; label: string } }) {
  const { s } = useStore()
  // A manager sees their own teams: the same page, worked out on just their people.
  const c = scope ? scopedView(full, scope.seats) : full
  const t = s.today
  const [who, setWho] = useState("everyone")
  const person = c.seats.find((x) => x.id === who)
  // Filtering by a person scales team numbers to that person's share (prototype approximation).
  const share = person ? (1 / Math.max(1, c.seats.length)) * 2.2 : 1
  const st = teamStats(c, t)
  // Same count and rule as the Team page.
  const rec = recordingNow(c, c.seats, t)
  const cats = byCategory(c, t)
  const vis = visibleWorkflows(c, t)
  // Work someone said must never be automated is not an opportunity.
  const opps = vis.filter((w) => !w.neverAutomate).sort((a, b) => valueMo(c, b.hoursWk, b.category) - valueMo(c, a.hoursWk, a.category))
  const focus = goalFocus(c)
  const top = vis.filter((w) => !w.neverAutomate).sort((a, b) => tunedScore(c, b, focus) - tunedScore(c, a, focus)).slice(0, 5)
  const maxCat = Math.max(1, ...cats.map((x) => x.total))
  const maxDay = Math.max(1, ...st.daily.map((d) => d.h))
  const asks = slackAsks(full, t)
  const rt = responseTime(full)
  const hand = handoffs(full).slice(0, 4)
  const ba = beforeAfter(full, t)
  const rateSrc = rateFor(full, "Reporting").source

  const oppRows = opps.map((w) => ({ name: w.name, cat: <CatBubble c={w.category} />, hrs: Math.round(w.hoursWk * WK_TO_MO * share), rate: `$${rateFor(c, w.category).rate}/h`, usd: money(valueMo(c, w.hoursWk, w.category) * share) }))
  // Managers see team-level dollars, never a pay rate.
  const oppCols = [{ key: "name", label: "Opportunity" }, { key: "cat", label: "Category" }, { key: "hrs", label: "Hours / mo", right: true }, ...(rates ? [{ key: "rate", label: "Rate", right: true }] : []), { key: "usd", label: "Value / mo", right: true }]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[var(--text-secondary)]">{person ? `Showing ${person.name}'s share. Response time stays team-wide.` : scope ? `Showing ${scope.label}. Slack and before-and-after numbers are company-wide.` : "Showing the whole company."}</span>
        {people && <Select value={who} onValueChange={(v) => v && setWho(String(v))}>
          <SelectTrigger aria-label="Team member" className="h-9 min-w-48 rounded-xl bg-card"><Users className="size-4 text-[var(--text-muted)]" /><span className="flex-1 text-left text-sm">{person ? person.name : "Everyone"}</span></SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">Everyone</SelectItem>
            {c.seats.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}{x.name !== x.role ? ` · ${x.role}` : ""}</SelectItem>)}
          </SelectContent>
        </Select>}
      </div>

      <div data-tour="kpis" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <RowsSheet title="Opportunity value a month" description={rateSrc === "payroll" ? "Hours times the pay rate of the people who do the work (payroll)" : rates ? "Hours times an estimated $38/h. Connect payroll for real rates." : "Hours times an estimated rate until payroll is connected."} columns={oppCols} rows={oppRows}>
          <Kpi icon={<DollarSign />} hue="#1baf7a" label="Opportunity value a month" value={money(st.dollars * share)} note={rateSrc === "payroll" ? "From your payroll rates" : "Estimated rate · connect payroll"} />
        </RowsSheet>
        <RowsSheet title="Opportunity hours a month" description="Every published opportunity" columns={oppCols} rows={oppRows}>
          <Kpi icon={<Clock />} hue="#2a78d6" label="Opportunity hours a month" value={Math.round(st.total * share)} note={<span className="mt-1 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">{(["H", "M", "L"] as const).map((k) => <span key={k} style={{ width: `${st.total ? (st[k] / st.total) * 100 : 0}%`, background: TIER_C[k] }} />)}</span>} />
        </RowsSheet>
        <RowsSheet title="Activity observed" description="Hours of work Shadow received, per day" columns={[{ key: "d", label: "Day" }, { key: "h", label: "Hours", right: true }]} rows={st.daily.map((d) => ({ d: fmt(d.d), h: Math.round(d.h * share).toLocaleString() }))}>
          <Kpi icon={<Radio />} hue="#6250d6" label="Activity observed" value={`${Math.round(st.observed * share).toLocaleString()} h`} note={`${st.workflows} workflows · last 14 days`} />
        </RowsSheet>
        <RowsSheet title="People recording" columns={[{ key: "n", label: "Person" }, { key: "r", label: "Role" }, { key: "s", label: "Status" }]} rows={rec.rows.map((x) => ({ n: x.s.name, r: x.s.role, s: x.status }))}>
          <Kpi icon={<Users />} hue="#eb6834" label="People recording" value={`${rec.on}/${rec.of}`} note={rec.attention.length ? `${rec.attention.length} need attention: ${rec.attention.slice(0, 3).map((x) => x.s.name.split(" ")[0]).join(", ")}` : "Everyone recording"} t={rec.attention.length ? "warn" : undefined} />
        </RowsSheet>
      </div>

      {(dayN(c, t) ?? 0) >= 14 && <Section title="Before and after" sub={scope ? "Company-wide · before Shadow, the last 30 days, and now" : "Before Shadow, the last 30 days, and now"}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ba.map((m) => {
            const improved = m.better === "down" ? m.now < m.before : m.now > m.before
            const delta = m.now - m.before
            return (
              <div key={m.name} className="flex flex-col gap-3 rounded-2xl border p-4">
                <span className="text-sm font-medium leading-snug">{m.name}</span>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">{m.now}<span className="text-base font-medium text-[var(--text-muted)]">{m.unit === "%" ? "%" : ` ${m.unit}`}</span></span>
                  {delta !== 0 && <span className={cn("mb-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium", improved ? "bg-[var(--good-bg)] text-[var(--delta-good)]" : "bg-[var(--bad-bg)] text-[var(--delta-bad)]")}>{delta < 0 ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}{Math.abs(Math.round(delta * 10) / 10)}</span>}
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {[["Before", m.before], ["30 days", m.mid], ["Now", m.now]].map(([k, v], i) => (
                    <div key={String(k)} className={cn("flex flex-col rounded-lg px-2 py-1.5", i === 2 ? "bg-[var(--seq-100)] text-[var(--seq-900)]" : "bg-[var(--surface-2)] text-[var(--text-secondary)]")}><span>{k}</span><span className="font-semibold tabular-nums">{v}</span></div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Section>}

      {c.pilot && <PilotSignals p={c.pilot} />}

      <div data-tour="opps" className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title="Top opportunities" sub={focus.size ? "Ranked by value a month and your goals · click for the workflow" : "Ranked by value a month · click for the workflow"} right={focus.size ? <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--seq-100)] px-3 text-xs font-medium text-[var(--seq-900)]"><Target className="size-3.5" />Tuned to your goals</span> : undefined}>
          <div className="flex flex-col">
            {top.map((w, i) => (
              <button key={w.id} onClick={() => go("workflows", w.category)} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-t py-2.5 text-left first:border-t-0 hover:bg-[var(--surface-2)]">
                <span className="grid size-6 place-items-center rounded-full bg-[var(--seq-100)] text-xs font-semibold text-[var(--seq-900)]">{i + 1}</span>
                <span className="flex min-w-0 flex-col gap-1"><span className="truncate text-sm font-medium">{w.name}</span><span className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><CatBubble c={w.category} />{Math.round(w.hoursWk * WK_TO_MO * share)} h a month{!!w.handoffBy?.length && <span className="text-[var(--delta-good)]">· hand-off named in {w.handoffBy.length} {w.handoffBy.length === 1 ? "interview" : "interviews"}</span>}</span></span>
                <span className="text-lg font-semibold tabular-nums text-[var(--delta-good)]">{money(valueMo(c, w.hoursWk, w.category) * share)}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Opportunity hours by category" sub="A month · click a row for its workflows" right={<Legend items={[["High", TIER_C.H], ["Medium", TIER_C.M], ["Low", TIER_C.L]]} />}>
          <div className="flex flex-col gap-1">
            {cats.map((x) => (
              <button key={x.name} onClick={() => go("workflows", x.name)} title={`${x.name}: ${Math.round(x.total)} h/mo`} className="grid grid-cols-[120px_minmax(0,1fr)_40px] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--surface-2)]">
                <CatBubble c={x.name} className="justify-self-start" />
                <span className="flex h-3 gap-0.5">{(["H", "M", "L"] as const).map((k) => x[k] > 0 && <span key={k} className="rounded-r-[3px]" style={{ width: `${(x[k] / maxCat) * 100}%`, background: TIER_C[k] }} />)}</span>
                <span className="text-right text-sm font-semibold tabular-nums">{Math.round(x.total * share)}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title="Slack asks" sub={scope ? "Company-wide · requests by topic, last 30 days" : "Requests to the team, by topic · last 30 days"}>
          {!asks ? <p className="py-4 text-sm text-[var(--text-muted)]">Not connected. Connect Slack to see open and finished asks.</p> : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <RowsSheet title="Open asks" columns={[{ key: "t", label: "Topic" }, { key: "o", label: "Open", right: true }]} rows={asks.rows.map((r) => ({ t: r.topic, o: r.open }))}><div className="flex flex-col rounded-2xl bg-[var(--watch-bg)] p-3"><span className="text-2xl font-semibold tabular-nums text-[var(--watch-fg)]">{asks.open}</span><span className="text-xs text-[var(--watch-fg)]">open of {asks.total}</span></div></RowsSheet>
                <div className="flex flex-col rounded-2xl bg-[var(--surface-2)] p-3"><span className="text-2xl font-semibold tabular-nums">{asks.medianHours}h</span><span className="text-xs text-[var(--text-muted)]">median to done</span></div>
                <div className="flex flex-col rounded-2xl bg-[var(--seq-100)] p-3"><span className="flex items-center gap-1 text-2xl font-semibold tabular-nums text-[var(--seq-900)]"><Link2 className="size-4" />{asks.linkedPct}%</span><span className="text-xs text-[var(--seq-900)]">linked to the work after</span></div>
              </div>
              <div className="flex flex-col gap-2">
                {asks.rows.map((r) => (
                  <div key={r.topic} className="grid grid-cols-[130px_minmax(0,1fr)_64px] items-center gap-3 text-sm" title={`${r.topic}: ${r.done} done, ${r.open} open, ${r.hoursToDone}h to done`}>
                    <span className="truncate">{r.topic}</span>
                    <span className="flex h-2.5 gap-0.5"><span className="rounded-l-full bg-[var(--status-good)]" style={{ width: `${(r.done / asks.rows[0].total) * 70}%` }} /><span className="rounded-r-full bg-[var(--status-warning)]" style={{ width: `${(r.open / asks.rows[0].total) * 70}%` }} /></span>
                    <span className="text-right text-xs tabular-nums text-[var(--text-secondary)]">{r.hoursToDone}h</span>
                  </div>
                ))}
              </div>
              <div className="mt-3"><Legend items={[["Done", "var(--status-good)"], ["Open", "var(--status-warning)"]]} /></div>
            </>
          )}
        </Section>
        <Section title="Reply time to @mentions" sub={scope ? "Company-wide median, from Slack" : "Team median, from Slack"}>
          {!c.slackConnected ? <p className="py-4 text-sm text-[var(--text-muted)]">Connect Slack to see reply times.</p> : <>
          <div className="flex items-baseline gap-2"><span className="text-4xl font-semibold tracking-[-0.03em] tabular-nums">{rt.medianMin}<span className="text-lg text-[var(--text-muted)]"> min</span></span><span className="text-xs text-[var(--text-muted)]">{rt.within1h}% within an hour</span></div>
          <div className="mt-4 flex flex-col gap-2">
            {rt.buckets.map(([k, p], i) => <div key={k} className="grid grid-cols-[90px_minmax(0,1fr)_40px] items-center gap-3 text-sm"><span className="text-xs text-[var(--text-secondary)]">{k}</span><span className="h-2 rounded-full bg-[var(--surface-2)]"><span className="block h-2 rounded-full" style={{ width: `${(p / 0.31) * 100}%`, background: ["#22a06b", "#7fc9a5", "#f0a400", "#f08c4a", "#e5484d"][i] }} /></span><span className="text-right text-xs tabular-nums">{Math.round(p * 100)}%</span></div>)}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">{scope ? "For the whole company; not split by team." : "Shown for the team only, never per person."}</p>
        </>}
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Where work waits" sub="Handoffs between teams · average wait">
          {!c.slackConnected ? <p className="py-4 text-sm text-[var(--text-muted)]">Connect Slack to see where work waits between teams.</p> : <>
          <div className="flex flex-col">
            {hand.map((h) => (
              <div key={h.from + h.to} className="grid grid-cols-[minmax(0,1fr)_60px_70px] items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
                <span className="truncate">{h.from} <span className="text-[var(--text-muted)]">to</span> {h.to}</span>
                <span className="text-right text-xs text-[var(--text-muted)] tabular-nums">{h.count}×</span>
                <span className={cn("justify-self-end rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", h.waitHrs > 18 ? "bg-[var(--bad-bg)] text-[var(--delta-bad)]" : h.waitHrs > 8 ? "bg-[var(--watch-bg)] text-[var(--watch-fg)]" : "bg-[var(--good-bg)] text-[var(--delta-good)]")}>{h.waitHrs}h</span>
              </div>
            ))}
          </div>
        </>}
        </Section>
        <Section title="Team hours per day" sub="Activity, last 14 days">
          <div className="flex h-36 items-end gap-1.5 border-b">
            {st.daily.map((d) => <div key={d.d} title={`${fmt(d.d)}: ${d.h} h`} className="flex h-full flex-1 items-end justify-center"><div className="w-full max-w-5 rounded-t-[4px] bg-[var(--bronze)]" style={{ height: `${Math.max(2, (d.h / maxDay) * 100)}%` }} /></div>)}
          </div>
          <div className="flex gap-1.5 pt-1.5">{st.daily.map((d) => <span key={d.d} className="flex-1 text-center text-xs text-[var(--text-muted)]">{"SMTWTFS"[weekday(d.d)]}</span>)}</div>
        </Section>
      </div>

      {st.observed > 0 && <Section title="Where team time goes" sub={`${st.observed.toLocaleString()} hours of activity`}>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">{MIX.map(([n, p], i) => <span key={n} title={`${n}: ${Math.round(p * 100)}%`} style={{ width: `${p * 100}%`, background: MIX_C[i] }} />)}</div>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-2">
          {MIX.map(([n, p], i) => <span key={n} className="flex items-center gap-2 text-sm"><span className="size-2.5 rounded-full" style={{ background: MIX_C[i] }} /><span className="flex-1">{n}</span><span className="font-semibold tabular-nums">{Math.round(p * 100)}%</span></span>)}
        </div>
      </Section>}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[var(--radius-card)] border bg-card px-6 py-4">
        {(c.pilot
          ? [["Uploads", c.pilot.collected.uploads.toLocaleString()], ["Activity events", c.pilot.collected.events.toLocaleString()], ["Slack messages", c.pilot.collected.slackMessages.toLocaleString()], ["Slack channels", String(c.pilot.collected.channels)]]
          : [["Activity events", Math.round(st.observed * 215).toLocaleString()], ["Screenshots", Math.round(st.observed * 50).toLocaleString()], ["Slack messages", c.slackConnected ? Math.round(c.seats.length * 650).toLocaleString() : "Not connected"], ["Runs", Math.round(vis.reduce((n, w) => n + w.runs, 0)).toLocaleString()]]
        ).map(([k, v]) => (
          <div key={k} className="flex flex-col"><span className="text-lg font-semibold tabular-nums">{v}</span><span className="text-xs text-[var(--text-muted)]">{k}</span></div>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Connect</span>
          {([["HubSpot", c.connections.hubspot], ["Calendar", c.connections.calendar], ["Payroll", c.connections.payroll !== "none"], ["Call notes", c.connections.callNotes]] as [string, boolean][]).map(([x, on]) => on
            ? <span key={x} className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--good-bg)] px-3 text-xs font-medium text-[var(--delta-good)]"><CheckCircle2 className="size-3.5" />{x}</span>
            : <button key={x} onClick={() => go("settings")} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"><Plus className="size-3.5" />{x}</button>)}
        </div>
      </div>
    </div>
  )
}

/** The six company areas from Mina's command-view spec, on his real pilot numbers. */
function PilotSignals({ p }: { p: Pilot }) {
  const tiles: { area: string; value: string; meaning: string; status: string; tone: "bad" | "warn" | "good" | "muted" }[] = [
    { area: "Sales", value: `${p.sales.untouched} of ${p.sales.leads}`, meaning: `new leads untouched · ${p.sales.untouchedBig} from $1M+ firms`, status: "Leaking", tone: "bad" },
    { area: "Red Zone deals", value: `${p.redZone.over14d}`, meaning: `waiting 14+ days · ${p.redZone.withNext} of ${p.redZone.deals} have a next meeting`, status: "Leaking", tone: "bad" },
    { area: "Signed", value: `$${p.signed.value.toLocaleString()}`, meaning: `${p.signed.quotes} quotes · $${p.signed.loggedWrongValue.toLocaleString()} logged wrong in the CRM`, status: "Fix the CRM", tone: "warn" },
    { area: "Product customers", value: `${p.customers.quiet30} quiet`, meaning: `of ${p.customers.channels} · ${p.customers.down30} down 30%+`, status: "Churn risk", tone: "bad" },
    { area: "Team", value: `${p.team.topShare}%`, meaning: `of messages from one person · ${p.team.tasksFinished} of ${p.team.tasks.toLocaleString()} tasks show a finish`, status: "Key-person risk", tone: "warn" },
    { area: "Cash", value: "Not connected", meaning: "connect billing to see collected vs signed", status: "Not connected", tone: "muted" },
  ]
  const toneCls = { bad: "bg-[var(--bad-bg)] text-[var(--delta-bad)]", warn: "bg-[var(--watch-bg)] text-[var(--watch-fg)]", good: "bg-[var(--good-bg)] text-[var(--delta-good)]", muted: "bg-[var(--surface-2)] text-[var(--text-secondary)]" }
  const funnel = [["Leads in", p.sales.leads], ["Replied in 5 min", p.sales.within5m], ["Replied at all", p.sales.replied], ["Booked a call", p.sales.booked]] as [string, number][]
  return (
    <Section title="Your company at a glance" sub={p.label}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((x) => (
          <div key={x.area} className="flex flex-col gap-1.5 rounded-2xl border p-4">
            <span className="text-xs text-[var(--text-muted)]">{x.area}</span>
            <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">{x.value}</span>
            <span className="text-xs leading-snug text-[var(--text-secondary)]">{x.meaning}</span>
            <span className={cn("mt-1 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", toneCls[x.tone])}>{x.tone !== "muted" && <AlertTriangle className="size-3" />}{x.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Where new leads leak</span>
          {funnel.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)_36px] items-center gap-3 text-sm">
              <span className="text-xs text-[var(--text-secondary)]">{k}</span>
              <span className="h-3 rounded-full bg-[var(--surface-2)]"><span className="block h-3 rounded-full" style={{ width: `${Math.max(1.5, (v / p.sales.leads) * 100)}%`, background: v === 0 ? "var(--status-critical)" : "#2a78d6" }} /></span>
              <span className="text-right font-semibold tabular-nums">{v}</span>
            </div>
          ))}
          <span className="text-xs text-[var(--text-muted)]">Median first reply {p.sales.medianReplyH} hours.</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Client results (lead volume)</span>
          <div className="flex items-end gap-6">
            <div><div className="text-3xl font-semibold tabular-nums">{p.clientResults.last4}</div><div className="text-xs text-[var(--text-muted)]">leads, last 4 weeks</div></div>
            <div><div className="text-3xl font-semibold tabular-nums text-[var(--text-muted)]">{p.clientResults.prior4}</div><div className="text-xs text-[var(--text-muted)]">the 4 before</div></div>
          </div>
          <span className="w-fit rounded-full bg-[var(--watch-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--watch-fg)]">Unanswered-lead audit paused since {p.clientResults.auditPausedSince}</span>
        </div>
      </div>
    </Section>
  )
}

export function Legend({ items }: { items: [string, string][] }) {
  return <div className="flex gap-3 text-xs text-[var(--text-secondary)]">{items.map(([n, c]) => <span key={n} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: c }} />{n}</span>)}</div>
}

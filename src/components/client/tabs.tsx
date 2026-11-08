"use client"

import { useState } from "react"
import { Ban, Bot, CheckCircle2, Hand, Target } from "lucide-react"
import { CatBubble, Kpi, Pill, Section, Segmented } from "@/components/bits"
import { FitChart } from "@/components/fit-chart"
import { ToolChip } from "@/components/sop-view"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CATS, liveAgents, processes, processTrend, valueMo, WK_TO_MO } from "@/lib/client-data"
import { goalFocus, goalState, tuned } from "@/lib/goals"
import { recurringMonths } from "@/lib/health"
import { fmt } from "@/lib/dates"
import { dateOfDay, hoursBack, newReport, visibleWorkflows } from "@/lib/engine"
import { useStore } from "@/lib/store"
import type { Client, Role, Seat, Tier, Workflow } from "@/lib/types"
import { clientTags, FUNCTIONS, orgOf, podTimes, scopeFor, teamShare } from "@/lib/teams"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Empty } from "./home"
import { APP } from "@/lib/flags"

const TIER: Record<Tier, [string, string]> = { H: ["High return", "#1c5cab"], M: ["Medium return", "#3987e5"], L: ["Low return", "#86b6ef"] }
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m` : `${Math.round(m)}m`)

// ── Work: workflows + processes ─────────────────────────────────────────────

export function WorkTab({ c, initialCat, only, role = "Owner", me }: { c: Client; initialCat?: string; only: "workflows" | "processes"; role?: Role; me?: Seat }) {
  const { s } = useStore()
  const view = only
  const [cat, setCat] = useState(initialCat ?? "All")
  const org = orgOf(c)
  const sc = scopeFor(c, role, me ?? c.seats[0])
  // In pods, the same work can be seen per pod or by function across every pod.
  const [lens, setLens] = useState<"team" | "function">(sc.fn ? "function" : "team")
  const teamOpts = lens === "function" ? [...FUNCTIONS].filter((f) => role === "Owner" || f === sc.fn || sc.teams.includes(f)) : sc.teams
  const [team, setTeam] = useState(role === "Owner" ? "All" : teamOpts[0] ?? "All")
  const [client, setClient] = useState("All")
  const tags = clientTags(c)
  const all = visibleWorkflows(c, s.today)
  // A team's view shows its share of each workflow's hours; a client tag keeps the work for that client.
  const vis = all
    .map((w) => (team === "All" ? w : { ...w, hoursWk: Math.round(w.hoursWk * teamShare(c, w, team) * 10) / 10 }))
    .filter((w) => w.hoursWk > 0 && (client === "All" || (w.clients ?? []).includes(client)))
  const focus = goalFocus(c)
  const [tune, setTune] = useState(focus.size > 0)
  const [sel, setSel] = useState<string | null>((focus.size ? tuned(c, vis) : vis)[0]?.id ?? null)
  if (!all.length) return <Empty title="Findings are being reviewed" body={`${APP} is learning how your team works. We review every finding before it shows up here.`} />
  const filtered = vis.filter((w) => cat === "All" || w.category === cat)
  const shown = tune ? tuned(c, filtered) : [...filtered].sort((a, b) => b.hoursWk - a.hoursWk)
  const served = vis.filter((x) => focus.has(x.category)).length
  const w = vis.find((x) => x.id === sel) ?? vis[0]
  const procs = processes(c, s.today)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {view === "workflows" && ["All", ...CATS].map((k) => <button key={k} aria-pressed={cat === k} onClick={() => setCat(k)} className={cn("h-8 rounded-full border px-3 text-sm", cat === k ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "bg-card text-[var(--text-secondary)]")}>{k}</button>)}
        {view === "workflows" && focus.size > 0 && (
          <button aria-pressed={tune} onClick={() => setTune(!tune)} className={cn("ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm", tune ? "border-[var(--bronze)] bg-[var(--seq-100)] font-medium text-[var(--seq-900)]" : "bg-card text-[var(--text-secondary)]")}>
            <Target className="size-3.5" />Tuned to your goals
          </button>
        )}
      </div>
      {view === "workflows" && (
        <div className="flex flex-wrap items-center gap-2">
          {org !== "function" && <Segmented label="Group work" value={lens} onChange={(v) => { setLens(v as "team" | "function"); setTeam("All") }} options={[{ id: "team", label: org === "pod" ? "By pod" : "By team" }, { id: "function", label: "By function across pods" }]} />}
          <Select value={team} onValueChange={(v) => v && setTeam(String(v))}>
            <SelectTrigger aria-label="Team" className="h-9 min-w-44 rounded-xl bg-card"><span className="flex-1 text-left text-sm">{team === "All" ? (lens === "function" ? "Every function" : "Every team") : team}</span></SelectTrigger>
            <SelectContent>{role === "Owner" && <SelectItem value="All">{lens === "function" ? "Every function" : "Every team"}</SelectItem>}{teamOpts.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
          {tags.length > 0 && (
            <Select value={client} onValueChange={(v) => v && setClient(String(v))}>
              <SelectTrigger aria-label="Client" className="h-9 min-w-44 rounded-xl bg-card"><span className="flex-1 text-left text-sm">{client === "All" ? "Every client" : `Client: ${client}`}</span></SelectTrigger>
              <SelectContent><SelectItem value="All">Every client</SelectItem>{tags.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}
      {view === "workflows" && lens === "function" && org !== "function" && <p className="rounded-2xl bg-[var(--seq-100)] px-4 py-3 text-sm text-[var(--seq-900)]">The same work runs in every pod. An agent built once for {team === "All" ? "a function" : team} rolls out to all {c.pods?.length} pods.</p>}
      {view === "workflows" && tune && focus.size > 0 && <p className="text-sm text-[var(--text-secondary)]">{served} of {vis.length} workflows serve {goalState(c) === "draft" ? "your draft goals" : "your locked goals"}. They rank first in each group and carry a goal mark.</p>}
      {view === "processes" ? (
        <div data-tour="processes" className="grid gap-4 lg:grid-cols-2">
          {procs.map((p) => {
            const tot = p.stages.reduce((n, x) => n + x[1], 0)
            const slow = p.stages.reduce((a, b) => (b[1] > a[1] ? b : a))
            return (
              <div key={p.name} className="flex flex-col gap-3 rounded-[var(--radius-card)] border bg-card p-6">
                <div className="flex justify-between gap-3"><span className="text-lg font-semibold">{p.name}</span><span className="text-right"><span className="block font-semibold tabular-nums">{Math.round(p.hours)} h/mo</span><Spark v={processTrend(c, p.name, p.hours)} /></span></div>
                {vis.some((w) => p.cats.includes(w.category) && w.verifiedBy?.length) && <span className="flex items-center gap-1 text-xs text-[var(--delta-good)]"><CheckCircle2 className="size-3.5" />{vis.filter((w) => p.cats.includes(w.category) && w.verifiedBy?.length).length} of its workflows verified in interviews</span>}
                <div className="flex h-9 gap-0.5">{p.stages.map(([n, m]) => <div key={n} title={`${n}: ${fmtMin(m)}`} className={cn("flex min-w-0 items-center justify-center rounded-md text-xs font-medium", n === slow[0] ? "bg-[var(--bronze)] text-white" : "bg-[var(--seq-100)] text-[var(--seq-900)]")} style={{ flex: `${Math.max((m / tot) * 100, 10)} 1 0` }}>{fmtMin(m)}</div>)}</div>
                <div className="flex gap-0.5">{p.stages.map(([n, m]) => <span key={n} className="min-w-0 truncate text-center text-xs text-[var(--text-muted)]" style={{ flex: `${Math.max((m / tot) * 100, 10)} 1 0` }}>{n}</span>)}</div>
                <span className="text-xs text-[var(--watch-fg)]">Slowest step: {slow[0]}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {w && <WorkflowDetail c={c} w={w} />}
          {vis.length === 0 && <Empty title="Nothing here" body="No published workflows match this team and client." />}
          {(["H", "M", "L"] as Tier[]).map((t) => {
            const rows = shown.filter((x) => x.tier === t)
            if (!rows.length) return null
            return (
              <section key={t} data-tour={t === "H" ? "workflows" : undefined} className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
                <div className="flex items-center justify-between px-6 py-4"><span className="flex items-center gap-2.5 font-semibold"><span className="size-2.5 rounded-full" style={{ background: TIER[t][1] }} />{TIER[t][0]}<span className="text-xs font-normal text-[var(--text-muted)]">{rows.length} workflows</span></span><span className="font-semibold tabular-nums">{Math.round(rows.reduce((n, x) => n + (x.neverAutomate ? 0 : x.hoursWk * WK_TO_MO), 0))} h/mo</span></div>
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[minmax(200px,2fr)_minmax(110px,1fr)_70px_70px_80px_minmax(140px,1.4fr)] gap-3 border-t px-6 py-2 text-xs text-[var(--text-muted)]"><span>Workflow</span><span>Category</span><span className="text-right">People</span><span className="text-right">Runs</span><span className="text-right">Avg</span><span>Hours / mo</span></div>
                    {rows.map((x) => (
                      <button key={x.id} onClick={() => setSel(x.id)} className={cn("grid w-full grid-cols-[minmax(200px,2fr)_minmax(110px,1fr)_70px_70px_80px_minmax(140px,1.4fr)] items-center gap-3 border-t px-6 py-3 text-left text-sm hover:bg-[var(--surface-2)]", sel === x.id && "bg-[var(--seq-100)]")}>
                        <span className="flex min-w-0 items-center gap-1.5 font-medium">{tune && focus.has(x.category) && <Target className="size-3.5 shrink-0 text-[var(--bronze)]" aria-label="Serves a goal" />}<span className="truncate">{x.name}</span>{!!x.verifiedBy?.length && <CheckCircle2 className="size-3.5 shrink-0 text-[var(--status-good)]" aria-label={`Verified by ${x.verifiedBy.join(", ")}`} />}{x.neverAutomate && <Ban className="size-3.5 shrink-0 text-[var(--delta-bad)]" aria-label="Never automate" />}</span><span><CatBubble c={x.category} /></span>
                        <span className="text-right tabular-nums">{x.people}</span><span className="text-right tabular-nums">{x.runs}</span><span className="text-right tabular-nums">{fmtMin(x.avgMin)}</span>
                        <span className="flex items-center gap-2"><span className="h-1.5 flex-1 rounded-full bg-[var(--surface-2)]"><span className="block h-1.5 rounded-full" style={{ width: `${Math.min(100, (x.hoursWk / Math.max(...vis.map((v) => v.hoursWk))) * 100)}%`, background: TIER[t][1] }} /></span><span className="w-9 text-right font-semibold tabular-nums">{Math.round(x.hoursWk * WK_TO_MO)}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function Spark({ v }: { v: number[] }) {
  const max = Math.max(...v), min = Math.min(...v)
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 60},${16 - ((x - min) / (max - min || 1)) * 14}`).join(" ")
  return (
    <svg width="64" height="18" viewBox="-2 -1 64 18" role="img" aria-label={`Last 6 weeks, from ${v[0]} to ${v[v.length - 1]} hours a week`} className="mt-1">
      <polyline points={pts} fill="none" stroke="var(--bronze)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Where an interview touched this workflow: who verified it, who would hand it off, and anything never to automate. */
export function InterviewTags({ w }: { w: Workflow }) {
  const names = (l: string[]) => (l.length > 2 ? `${l.slice(0, 2).map((n) => n.split(" ")[0]).join(", ")} and ${l.length - 2} more` : l.map((n) => n.split(" ")[0]).join(" and "))
  if (!w.verifiedBy?.length && !w.handoffBy?.length && !w.neverAutomate) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {!!w.verifiedBy?.length && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--good-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--delta-good)]"><CheckCircle2 className="size-3" />Verified by {names(w.verifiedBy)}</span>}
      {!!w.handoffBy?.length && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--seq-100)] px-2.5 py-0.5 text-xs font-medium text-[var(--seq-900)]"><Hand className="size-3" />Hand-off named by {names(w.handoffBy)}</span>}
      {w.neverAutomate && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bad-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--delta-bad)]"><Ban className="size-3" />Never automate · From {w.neverAutomate.by.split(" ")[0]}&apos;s interview</span>}
    </div>
  )
}

function WorkflowDetail({ c, w }: { c: Client; w: Workflow }) {
  const shares = [[100], [70, 30], [55, 30, 15], [45, 28, 17, 10], [12, 41, 26, 6, 15], [35, 22, 16, 12, 9, 6]][w.ways - 1]
  const ways = Array.from({ length: w.ways }, (_, i) => ({ avg: w.ways === 1 ? w.avgMin : w.minMin + ((w.maxMin - w.minMin) * i) / (w.ways - 1), share: shares[i] }))
  return (
    <div className="grid gap-6 rounded-[var(--radius-card)] border border-[var(--seq-500)] bg-card p-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]">{TIER[w.tier][0]} <CatBubble c={w.category} /></span>
        <InterviewTags w={w} />
        <span className="text-2xl font-semibold tracking-[-0.02em]">{w.name}</span>
        <div className="grid grid-cols-3 gap-3">
          {[[`$${Math.round(valueMo(c, w.hoursWk, w.category)).toLocaleString()}`, "opportunity a month"], [`${Math.round(w.hoursWk * WK_TO_MO)} h`, "found a month"], [String(w.runs), "runs in 2 weeks"]].map(([v, k]) => <div key={k}><div className="text-xl font-semibold tabular-nums">{v}</div><div className="text-xs text-[var(--text-muted)]">{k}</div></div>)}
        </div>
        <div className="flex flex-wrap gap-1.5">{w.tools.map((t) => <ToolChip key={t} t={t} compact />)}</div>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-xs text-[var(--text-muted)]">{w.ways} {w.ways === 1 ? "way" : "ways"} it&apos;s done · average time · share of runs</span>
        {ways.map((v, i) => (
          <div key={i} className="grid grid-cols-[64px_minmax(0,1fr)_64px_40px] items-center gap-3 text-sm">
            <span className="text-[var(--text-secondary)]">Way {i + 1}</span>
            <span className="h-2 rounded-full bg-[var(--surface-2)]"><span className="block h-2 rounded-full" style={{ width: `${(v.avg / w.maxMin) * 100}%`, background: i === 0 ? "var(--status-good)" : "#86b6ef" }} /></span>
            <span className="text-right font-semibold tabular-nums">{fmtMin(v.avg)}</span><span className="text-right text-xs tabular-nums text-[var(--text-muted)]">{v.share}%</span>
          </div>
        ))}
        {w.ways > 1 && <span className="text-xs text-[var(--delta-good)]">The fastest way is {Math.round(w.maxMin / w.minMin * 10) / 10}x quicker than the slowest.</span>}
        {podTimes(c, w).length > 1 && <PodVariance c={c} w={w} />}
      </div>
    </div>
  )
}

/** When the same workflow runs in several pods, the fastest pod's way is the candidate for the Playbook. */
function PodVariance({ c, w }: { c: Client; w: Workflow }) {
  const t = podTimes(c, w)
  const max = t[t.length - 1].mins
  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-3">
      <span className="text-xs text-[var(--text-muted)]">Average time a run, by pod</span>
      {t.map((x, i) => (
        <div key={x.pod} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_56px] items-center gap-3 text-sm">
          <span className="truncate text-[var(--text-secondary)]">{x.pod}</span>
          <span className="h-2 rounded-full bg-[var(--surface-2)]"><span className="block h-2 rounded-full" style={{ width: `${(x.mins / max) * 100}%`, background: i === 0 ? "var(--status-good)" : "#86b6ef" }} /></span>
          <span className="text-right font-semibold tabular-nums">{fmtMin(x.mins)}</span>
        </div>
      ))}
      <span className="text-xs text-[var(--delta-good)]">{t[0].pod} does this in {fmtMin(t[0].mins)}, {t[t.length - 1].pod} in {fmtMin(max)}. {t[0].pod}&apos;s way is the candidate for the Playbook.</span>
    </div>
  )
}

// ── Team (Fit Map) ──────────────────────────────────────────────────────────

export function TeamView({ c }: { c: Client }) {
  if (!c.fitPublished) return <Empty title="Your Team Fit Map is being built" body="From the Culture Intelligence survey your team takes in week one. It shows each person's strengths, fit to their role and where the team leans on one person." />
  return <div data-tour="fitmap"><Section title="Team Fit Map" sub="Your org chart and how well each person fits their role" right={c.ci.connected ? <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--seq-100)] px-3 text-xs font-medium text-[var(--seq-900)]"><span className="size-1.5 rounded-full bg-[var(--status-good)]" />From Culture Intelligence</span> : undefined}><FitChart c={c} /></Section></div>
}

// ── Automations ─────────────────────────────────────────────────────────────

export function AutomationsTab({ c, list: listOnly }: { c: Client; list?: boolean }) {
  const { s } = useStore()
  // Every agent, proposed ones included, so anything the Executive report asks you to approve is here.
  const list = liveAgents(c, s.today)
  const live = list.filter((x) => x.status === "live")
  const proposed = list.filter((x) => x.status === "proposed").length
  const word: Record<string, [string, "good" | "info" | "warn" | "muted"]> = { live: ["Live", "good"], qa: ["Testing", "warn"], qa_failing: ["Testing", "warn"], building: ["Building", "info"], approved: ["Approved", "muted"], proposed: ["Proposed", "muted"] }
  return (
    <div className="flex flex-col gap-5">
      {!listOnly && <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi label="Agents live" value={live.length} />
        <Kpi label="Hours back a week" value={Math.round(hoursBack(c, s.today) * 10) / 10} note="Against your day-0 baseline" />
        <Kpi label="In progress" value={list.length - live.length - proposed} note={proposed ? `Plus ${proposed} proposed, waiting for your OK` : undefined} />
      </div>}
      {list.length === 0 ? <Empty title="Your first agent is on the way" body="We pick it with you from the first week's findings." /> : (
        <Section title="Your agents">
          {list.map(({ a, status }) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0">
              <Bot className="size-4 text-[var(--text-muted)]" />
              <span className="min-w-48 flex-1 text-sm font-medium">{a.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{status === "live" ? `Saves ${Math.round(a.baselineHrsWk * a.savesPct * 10) / 10} h/wk` : dateOfDay(c, a.plannedLiveDay) ? `Planned ${fmt(dateOfDay(c, a.plannedLiveDay)!)}` : "Planned after kickoff"}</span>
              <Pill t={word[status][1]}>{word[status][0]}</Pill>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

/** After day 90: this month's deliverables, as the client sees them (no health score). */
function MonthlyPlan({ c }: { c: Client }) {
  const { s } = useStore()
  const m = recurringMonths(c, s.today).slice(-1)[0]
  if (!m) return null
  return (
    <Section title={`This month's deliverables, month ${m.month}`} sub="Part of your monthly plan">
      <div className="grid gap-2 sm:grid-cols-2">
        {m.items.map((d) => <span key={d.name} className="flex items-center gap-2 text-sm"><span className={cn("size-2 rounded-full", d.status === "Done" ? "bg-[var(--status-good)]" : d.status === "Due" ? "bg-[var(--text-muted)]" : "bg-[var(--status-warning)]")} /><span className="flex-1">{d.name}</span><span className="text-xs text-[var(--text-muted)]">{d.status === "Done" ? "Done" : d.status === "Due" ? `Due ${fmt(d.due)}` : "In progress"}</span></span>)}
      </div>
    </Section>
  )
}

// ── Reports ─────────────────────────────────────────────────────────────────

export function ReportsView({ c }: { c: Client }) {
  const { s, update } = useStore()
  // Newest first, for every client.
  const sent = c.reports.filter((r) => r.status === "sent").sort((a, b) => (b.sent ?? b.created).localeCompare(a.sent ?? a.created))
  const asked = c.reports.filter((r) => r.kind === "custom" && r.status !== "sent")
  const [open, setOpen] = useState<string | null>(sent[0]?.id ?? null)
  const [q, setQ] = useState("")
  return (
    <div className="flex flex-col gap-5">
    <MonthlyPlan c={c} />
    <div data-tour="reports" className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Section title="Your reports" sub={`${sent.length} sent`}>
        {sent.length === 0 && <p className="py-2 text-sm text-[var(--text-muted)]">Your first Weekly Progress Update arrives at the end of week one.</p>}
        {sent.map((r) => (
          <div key={r.id} className="border-t first:border-t-0">
            <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 py-3 text-left">
              <span className="flex-1 text-sm font-medium">{r.title}</span><span className="text-xs text-[var(--text-muted)]">{r.period}</span><span className="w-16 text-right font-mono text-xs text-[var(--text-muted)]">{fmt(r.sent!)}</span>
            </button>
            {open === r.id && <p className="mb-3 rounded-xl bg-[var(--surface-2)] p-4 text-sm leading-relaxed">{r.summary}</p>}
          </div>
        ))}
      </Section>
      <Section title="Ask for a report" sub="Tell Subhan what you want to know. Subhan prepares it and sends it here.">
        <Textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why do client reports take so long?" className="min-h-24 rounded-xl text-sm" />
        <Button className="mt-3 rounded-[10px]" disabled={!q.trim()} onClick={() => { const r = newReport(c, "custom", s.today, q.trim()); update(c.id, (x, t) => ({ ...x, reports: [r, ...x.reports], log: [{ date: t, text: `Client asked for a report: "${q.trim()}".` }, ...x.log] })); setQ("") }}>Send request</Button>
        <p className="mt-2 text-xs text-[var(--text-muted)]">We reply here when it&apos;s ready.</p>
        {asked.length > 0 && <div className="mt-4 flex flex-col gap-1.5 border-t pt-3">{asked.map((r) => <span key={r.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{r.request}</span><Pill t="warn">In progress</Pill></span>)}</div>}
      </Section>
    </div>
    </div>
  )
}


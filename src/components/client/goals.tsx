"use client"

// Goals in the client app. Owners and managers edit them as a draft and lock them in.
// Locked goals are read-only; "Request a change" lands in Studio's Requests inbox and only
// Aalpha approving it unlocks them. Every ranking in the app leans on the locked goals.

import { useState } from "react"
import { Clock, Lock, LockOpen, Plus, Send, Target, Trash2 } from "lucide-react"
import { CatBubble, Meter, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CATS, goalProgress, WK_TO_MO } from "@/lib/client-data"
import { fmt, fmtLong } from "@/lib/dates"
import { visibleWorkflows } from "@/lib/engine"
import { clientGoals, goalFocus, goalState, lockGoals, looksLikeQuota, requestGoalChange, visiblePersonal } from "@/lib/goals"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/lib/store"
import { CAT_FN, homeTeam, scopeFor, teamsOf } from "@/lib/teams"
import type { Client, Goal, GoalPriority, Role, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Empty } from "./home"

const METRICS = ["Hours back a week", "Reporting hours back a week", "Paid media hours back a week", "Approval hours back a week", "Sales hours back a week"]
const PRIO: Record<GoalPriority, "bad" | "warn" | "muted"> = { High: "bad", Medium: "warn", Low: "muted" }

export function GoalsView({ c, role, me }: { c: Client; role: Role; me: Seat }) {
  const { s, update, mutate } = useStore()
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState("")
  const goals = clientGoals(c)
  const state = goalState(c)
  const canEdit = role === "Owner" && state === "draft" // company goals are set by the owner with Aalpha
  const lock = c.goalLock
  const pendingReq = lock?.pending ? s.requests.find((r) => r.id === lock.pending) : null
  // A goal names the teams it covers: one pod or team, or the functions behind its categories.
  const coveredBy = (g: Goal) => g.team ?? (Array.from(new Set(g.categories.map((k) => CAT_FN[k]))).join(", ") || "Whole agency")
  const set = (id: string, patch: Partial<Goal>) => update(c.id, (x) => ({ ...x, goals: x.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))

  if (!goals.length && !canEdit) return <Empty title="Your goals are being written" body="We write them from your kickoff call. Every finding is ranked against them." />

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="goal-lock" className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border bg-card p-5">
        <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full", state === "locked" ? "bg-[var(--good-bg)] text-[var(--delta-good)]" : state === "pending" ? "bg-[var(--watch-bg)] text-[var(--watch-fg)]" : "bg-[var(--surface-2)] text-[var(--text-secondary)]")}>
          {state === "locked" ? <Lock className="size-4" /> : state === "pending" ? <Clock className="size-4" /> : <LockOpen className="size-4" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {state === "locked" ? "Goals locked" : state === "pending" ? "Change requested" : "Draft goals"}
            <Pill t={state === "locked" ? "good" : state === "pending" ? "warn" : "muted"}>{state === "locked" ? "Locked" : state === "pending" ? "Change pending" : "Draft"}</Pill>
          </span>
          <span className="text-sm text-[var(--text-secondary)]">
            {state === "locked" && `Locked by ${lock?.by} on ${fmtLong(lock!.at!)}. To change them, send a request. Aalpha reviews it and unlocks them.`}
            {state === "pending" && `Sent ${pendingReq ? fmt(pendingReq.created) : ""}. Your goals stay locked until Aalpha approves the change.`}
            {state === "draft" && (role !== "Owner" ? "The account owner sets these with Aalpha." : "Edit them here, then lock them in. Locked goals steer every ranking in the app.")}
          </span>
        </div>
        {role === "Owner" && state === "draft" && (goals.length
          ? <Button className="rounded-[10px]" onClick={() => mutate((p) => lockGoals(p, c.id, me.name))}><Lock />Lock in goals</Button>
          : <span className="text-xs text-[var(--text-muted)]">Aalpha drafts your goals with you at kickoff. Once they show here, you can lock them in.</span>)}
        {role === "Owner" && state === "locked" && !asking && <Button variant="outline" className="rounded-[10px]" onClick={() => setAsking(true)}>Request a change</Button>}
        {asking && state === "locked" && (
          <form className="flex w-full flex-col gap-2 border-t pt-4" onSubmit={(e) => { e.preventDefault(); mutate((p) => requestGoalChange(p, c.id, me.name, note.trim())); setAsking(false); setNote("") }}>
            <label htmlFor="goal-change" className="text-sm font-medium">What would you change?</label>
            <Textarea id="goal-change" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a goal for sales follow-up, and lower the reporting target to 18 hours." className="min-h-20 rounded-xl text-sm" />
            <div className="flex gap-2 self-end">
              <Button type="button" variant="ghost" className="rounded-[10px]" onClick={() => setAsking(false)}>Cancel</Button>
              <Button type="submit" className="rounded-[10px]"><Send />Send request</Button>
            </div>
          </form>
        )}
      </div>

      <div data-tour="goals" className="grid gap-4 lg:grid-cols-2">
        {goals.map((g) => {
          const p = goalProgress(c, g, s.today)
          return (
            <div key={g.id} className="flex flex-col gap-4 rounded-[var(--radius-card)] border bg-card p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                {canEdit ? (
                  <Select value={g.priority ?? "Medium"} onValueChange={(v) => v && set(g.id, { priority: v as GoalPriority })}>
                    <SelectTrigger size="sm" className="h-7 w-32 rounded-full text-xs" aria-label={`Priority for ${g.title}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{(["High", "Medium", "Low"] as GoalPriority[]).map((k) => <SelectItem key={k} value={k}>{k} priority</SelectItem>)}</SelectContent>
                  </Select>
                ) : <Pill t={PRIO[g.priority ?? "Medium"]}>{g.priority ?? "Medium"} priority</Pill>}
                {!canEdit && g.categories.map((k) => <CatBubble key={k} c={k} />)}
                {canEdit && <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label={`Delete ${g.title}`} onClick={() => update(c.id, (x) => ({ ...x, goals: x.goals.filter((y) => y.id !== g.id) }))}><Trash2 /></Button>}
              </div>
              {canEdit ? (
                <div className="flex flex-col gap-3">
                  <Input value={g.title} onChange={(e) => set(g.id, { title: e.target.value })} aria-label="Goal" className="h-10 rounded-[10px] text-base font-semibold" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={g.metric} onValueChange={(v) => v && set(g.id, { metric: String(v) })}>
                      <SelectTrigger size="sm" className="h-8 min-w-52 rounded-[10px] text-sm" aria-label="Metric"><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from(new Set([g.metric, ...METRICS])).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">Target
                      <Input type="number" min={1} value={g.target} onChange={(e) => set(g.id, { target: Math.max(1, Number(e.target.value)) })} className="h-8 w-20 rounded-[10px] text-sm" />h/wk
                    </label>
                  </div>
                  <Select value={g.team ?? "all"} onValueChange={(v) => v && set(g.id, { team: v === "all" ? null : String(v) })}>
                    <SelectTrigger size="sm" className="h-8 w-fit min-w-52 rounded-[10px] text-sm" aria-label="Team it belongs to"><span className="flex-1 text-left">{g.team ? `Team: ${g.team}` : "Whole agency"}</span></SelectTrigger>
                    <SelectContent><SelectItem value="all">Whole agency</SelectItem>{teamsOf(c).map((t) => <SelectItem key={t.name} value={t.name}>{t.kind === "pod" ? "Pod" : "Team"}: {t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Work it covers">
                    {CATS.map((k) => {
                      const on = g.categories.includes(k)
                      return <button key={k} aria-pressed={on} onClick={() => set(g.id, { categories: on ? g.categories.filter((x) => x !== k) : [...g.categories, k] })} className={cn("h-7 rounded-full border px-2.5 text-xs", on ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "text-[var(--text-secondary)]")}>{k}</button>
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold leading-snug">{g.title}</span>
                  <span className="text-xs text-[var(--text-muted)]">{g.metric} · target {g.target} h</span>
                  <span className="text-xs text-[var(--text-secondary)]">Covers: {coveredBy(g)}</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-xs text-[var(--text-muted)]"><span>Found toward it</span><span className="font-medium text-[var(--text-primary)] tabular-nums">{p.found.toFixed(1)} h/wk</span></span>
                  <Meter value={p.found} max={Math.max(g.target, p.found)} target={g.target} t={p.found >= g.target ? "good" : "info"} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-xs text-[var(--text-muted)]"><span>Back now</span><span className="font-medium text-[var(--text-primary)] tabular-nums">{p.back.toFixed(1)} of {g.target} h/wk</span></span>
                  <Meter value={p.back} max={Math.max(g.target, p.back)} target={g.target} t={p.back >= g.target ? "good" : "warn"} />
                </div>
              </div>
              {p.recs.length > 0 && (
                <ol className="flex flex-col gap-2 border-t pt-3 text-sm">
                  <span className="text-xs text-[var(--text-muted)]">Biggest workflows behind it</span>
                  {p.recs.map((r, i) => <li key={r.id} className="flex justify-between gap-3"><span><span className="mr-2 text-[var(--text-muted)]">{i + 1}</span>{r.name}</span><span className="font-semibold tabular-nums">{Math.round(r.hoursWk * WK_TO_MO)} h/mo</span></li>)}
                </ol>
              )}
            </div>
          )
        })}
        {canEdit && (
          <button onClick={() => update(c.id, (x) => ({ ...x, goals: [...x.goals, { id: `${x.id}-g${Date.now()}`, title: "New goal", metric: "Hours back a week", target: 5, categories: [], status: "published", priority: "Medium" }] }))}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed bg-card/60 text-sm text-[var(--text-secondary)] hover:bg-card">
            <Plus className="size-5" />Add a goal
          </button>
        )}
      </div>

      <TunedPanel c={c} />
    </div>
  )
}

/** How the goals steer the rest of the app, in plain numbers. */
function TunedPanel({ c }: { c: Client }) {
  const { s } = useStore()
  const focus = goalFocus(c)
  const vis = visibleWorkflows(c, s.today).filter((w) => !w.neverAutomate)
  if (!focus.size || !vis.length) return null
  const served = vis.filter((w) => focus.has(w.category))
  const hrs = served.reduce((n, w) => n + w.hoursWk * WK_TO_MO, 0)
  const cats = [...focus.entries()].sort((a, b) => b[1].weight - a[1].weight)
  return (
    <Section title="Tuned to your goals" sub={goalState(c) === "draft" ? "Rankings follow these goals now and lock with them" : "Every ranking in the app follows your locked goals"}>
      <div data-tour="tuned" className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-secondary)]">{served.length} of {vis.length} workflows serve a goal, worth {Math.round(hrs).toLocaleString()} hours a month. They rank first in Overview, Workflows and the Playbook, and the next agents are picked from them.</p>
        <div className="flex flex-col gap-2">
          {cats.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <CatBubble c={k} className="justify-self-start" />
              <span className="flex h-2 gap-0.5">{[1, 2, 3].map((i) => <span key={i} className={cn("flex-1 rounded-full", i <= v.weight ? "bg-[var(--bronze)]" : "bg-[var(--surface-2)]")} />)}</span>
              <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]"><Target className="size-3.5" />{v.goals.length} {v.goals.length === 1 ? "goal" : "goals"}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── team and personal goals ─────────────────────────────────────────────────

const STATUS = (on?: boolean) => <Pill t={on === false ? "warn" : "good"}>{on === false ? "Behind" : "On track"}</Pill>

/** Company goals stay at the top (above). Team goals serve a company goal; personal goals serve a
 *  team or company goal. Owners see every level, managers their teams and a summary of their
 *  people, members their team and their own goals in full. Wellbeing goals stay private. */
export function GoalLevels({ c, role, me }: { c: Client; role: Role; me: Seat }) {
  const { update, mutate } = useStore()
  const company = c.goals.filter((g) => (g.level ?? "company") === "company" && g.status === "published")
  const sc = scopeFor(c, role, me)
  const teams = teamsOf(c).map((t) => t.name).filter((t) => role === "Owner" || (role === "Manager" ? sc.teams.includes(t) : t === homeTeam(c, me)))
  const canTeam = (t: string) => role === "Owner" || (role === "Manager" && sc.teams.includes(t))
  const title = (id?: string | null) => c.goals.find((g) => g.id === id)?.title ?? "a company goal"
  const setGoal = (id: string, p: Partial<Goal>) => update(c.id, (x) => ({ ...x, goals: x.goals.map((g) => (g.id === id ? { ...g, ...p } : g)) }))
  const del = (id: string) => update(c.id, (x) => ({ ...x, goals: x.goals.filter((g) => g.id !== id) }))
  const addTeam = (t: string) => update(c.id, (x) => ({ ...x, goals: [...x.goals, { id: `${x.id}-tg${Date.now()}`, title: "New team goal", metric: "Hours back a week", target: 4, categories: [], status: "published", level: "team", team: t, parent: company[0]?.id ?? null, onTrack: true }] }))
  const proposedCo = c.goals.filter((g) => (g.level ?? "company") === "company" && g.status === "draft" && g.source)
  const locked = goalState(c) !== "draft"
  const people = (t: string) => c.seats.filter((s) => homeTeam(c, s) === t && s.id !== me.id)
  return (
    <div className="flex flex-col gap-5">
      {role !== "Member" && proposedCo.length > 0 && (
        <Section title="Proposed from interviews" sub="Company goals named in leadership interviews. They go through the same lock and approval as the rest.">
          {proposedCo.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
              <span className="flex min-w-48 flex-1 flex-col"><span className="font-medium">{g.title}</span><span className="text-xs text-[var(--text-muted)]">{g.source}</span></span>
              {role === "Owner" && (locked
                ? <Button size="sm" variant="outline" className="rounded-[10px]" disabled={goalState(c) === "pending"} onClick={() => mutate((p) => requestGoalChange(p, c.id, me.name, `Add "${g.title}" (${g.source}).`))}>Request a change to add it</Button>
                : <Button size="sm" className="rounded-[10px]" onClick={() => setGoal(g.id, { status: "published" })}>Add to company goals</Button>)}
              {role === "Owner" && <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => del(g.id)}>Dismiss</Button>}
            </div>
          ))}
        </Section>
      )}

      <div data-tour="team-goals"><Section title="Team goals" sub="1 to 3 per team, set by the team's manager. Each one serves a company goal.">
        <div className="grid gap-3 lg:grid-cols-2">
          {teams.map((t) => {
            const list = c.goals.filter((g) => g.level === "team" && g.team === t && (role !== "Member" || g.status !== "draft"))
            return (
              <div key={t} className="flex flex-col gap-2 rounded-2xl border p-4">
                <span className="flex items-center justify-between gap-2"><span className="font-semibold">{t}</span>{canTeam(t) && list.length < 3 && <Button size="xs" variant="ghost" onClick={() => addTeam(t)}><Plus />Add</Button>}</span>
                {list.length === 0 && <span className="text-sm text-[var(--text-muted)]">No team goals yet.</span>}
                {list.map((g) => (
                  <div key={g.id} className="flex flex-col gap-1.5 border-t pt-2 first:border-t-0 first:pt-0">
                    <span className="flex items-center gap-2">
                      {canTeam(t) ? <Input value={g.title} onChange={(e) => setGoal(g.id, { title: e.target.value })} aria-label="Team goal" className="h-8 flex-1 rounded-[10px] text-sm" /> : <span className="flex-1 text-sm font-medium">{g.title}</span>}
                      {g.status === "draft" ? <Pill t="muted">Proposed</Pill> : STATUS(g.onTrack)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      Serves:
                      {canTeam(t) ? (
                        <Select value={g.parent ?? ""} onValueChange={(v) => v && setGoal(g.id, { parent: String(v) })}>
                          <SelectTrigger size="sm" className="h-7 w-fit max-w-full rounded-[8px] text-xs" aria-label="Company goal it serves"><span className="truncate">{title(g.parent)}</span></SelectTrigger>
                          <SelectContent>{company.map((x) => <SelectItem key={x.id} value={x.id}>{x.title}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <span>{title(g.parent)}</span>}
                      {g.source && <span>· {g.source}</span>}
                      {canTeam(t) && g.status === "draft" && <Button size="xs" variant="outline" onClick={() => setGoal(g.id, { status: "published", onTrack: true })}>Accept</Button>}
                      {canTeam(t) && <Button size="xs" variant="ghost" aria-label={`Remove ${g.title}`} onClick={() => del(g.id)}><Trash2 /></Button>}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </Section></div>

      <PersonalGoals c={c} me={me} company={company} />

      {role === "Manager" && (
        <Section title="Your people's personal goals" sub="Summary only: whether each person is on track. The goals themselves are theirs.">
          {teams.flatMap((t) => people(t)).map((p) => {
            const g = c.goals.filter((x) => x.level === "personal" && x.ownerId === p.id && visiblePersonal(x, me.id))
            const behind = g.filter((x) => x.onTrack === false).length
            return <div key={p.id} className="flex items-center justify-between gap-3 border-t py-2 text-sm first:border-t-0"><span>{p.name}</span><span className="text-xs text-[var(--text-secondary)]">{g.length ? `${g.length - behind} on track${behind ? `, ${behind} behind` : ""}` : "None set yet"}</span></div>
          })}
        </Section>
      )}

      {role === "Owner" && (
        <Section title="Roll-up" sub="Company goal, the team goals under it, and whether each person is on track with their own">
          <div className="flex flex-col gap-4">
            {company.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Add and lock your company goals first. Team goals and each person&apos;s own goals sit under them.</p>}
            {company.map((cg) => (
              <div key={cg.id} className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-[var(--bronze)]" />{cg.title}</span>
                {c.goals.filter((g) => g.level === "team" && g.parent === cg.id && teams.includes(g.team ?? "")).map((tg) => {
                  const mine = c.goals.filter((g) => g.level === "personal" && g.parent === tg.id && visiblePersonal(g, me.id))
                  return (
                    <div key={tg.id} className="ml-5 flex flex-col gap-1 border-l pl-3 text-sm">
                      <span className="flex flex-wrap items-center gap-2"><span>{tg.title}</span><span className="text-xs text-[var(--text-muted)]">{tg.team}</span>{STATUS(tg.onTrack)}</span>
                      {mine.map((pg) => <span key={pg.id} className="ml-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]"><span>{c.seats.find((s) => s.id === pg.ownerId)?.name.split(" ")[0]}{pg.ownerId === me.id ? `: ${pg.title}` : ""}</span>{STATUS(pg.onTrack)}</span>)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">Personal goals stay with each person: you see only whether they&apos;re on track. Private wellbeing goals don&apos;t show at all. No rankings between people.</p>
        </Section>
      )}
    </div>
  )
}

/** A person's own goals: 1 to 3, about time back, each serving a team or company goal. */
function PersonalGoals({ c, me, company }: { c: Client; me: Seat; company: Goal[] }) {
  const { update } = useStore()
  const mine = c.goals.filter((g) => g.level === "personal" && g.ownerId === me.id)
  const parents = [...c.goals.filter((g) => g.level === "team" && g.team === homeTeam(c, me) && g.status === "published"), ...company]
  const set = (id: string, p: Partial<Goal>) => update(c.id, (x) => ({ ...x, goals: x.goals.map((g) => (g.id === id ? { ...g, ...p } : g)) }))
  return (
    <Section title="Your goals" sub="Goals about getting your time back. Only you can change them, and they aren't used in performance reviews." right={mine.length < 3 ? <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => update(c.id, (x) => ({ ...x, goals: [...x.goals, { id: `${me.id}-pg${Date.now()}`, title: "Hand off ", metric: "Hours back a week", target: 2, categories: [], status: "published", level: "personal", ownerId: me.id, parent: parents[0]?.id ?? null, onTrack: true }] }))}><Plus />Add a goal</Button> : undefined}>
      {mine.length === 0 && <p className="text-sm text-[var(--text-muted)]">None yet. Your interview suggests some, or add one like &ldquo;Hand off weekly status updates&rdquo;.</p>}
      <div className="flex flex-col gap-3">
        {mine.map((g) => (
          <div key={g.id} className="flex flex-col gap-2 rounded-2xl border p-3.5">
            <span className="flex items-center gap-2">
              <Input value={g.title} onChange={(e) => set(g.id, { title: e.target.value })} aria-label="Your goal" className="h-9 flex-1 rounded-[10px] text-sm" />
              {STATUS(g.onTrack)}
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${g.title}`} onClick={() => update(c.id, (x) => ({ ...x, goals: x.goals.filter((y) => y.id !== g.id) }))}><Trash2 /></Button>
            </span>
            {looksLikeQuota(g.title) && <span className="text-xs text-[var(--watch-fg)]">Personal goals are about time back, like &ldquo;Get 2 more hours of focus time a week&rdquo;, not sales or output targets.</span>}
            <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              Serves:
              <Select value={g.parent ?? ""} onValueChange={(v) => v && set(g.id, { parent: String(v) })}>
                <SelectTrigger size="sm" className="h-7 w-fit max-w-full rounded-[8px] text-xs" aria-label="Goal it serves"><span className="truncate">{c.goals.find((x) => x.id === g.parent)?.title ?? "Pick a goal"}</span></SelectTrigger>
                <SelectContent>{parents.map((x) => <SelectItem key={x.id} value={x.id}>{x.level === "team" ? `Team: ${x.title}` : `Company: ${x.title}`}</SelectItem>)}</SelectContent>
              </Select>
              {g.source && <span>· {g.source}</span>}
            </span>
            <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Switch checked={!!g.wellbeing} onCheckedChange={(v) => set(g.id, { wellbeing: !!v, shared: v ? g.shared : false })} aria-label="Wellbeing goal" />Wellbeing goal
              {g.wellbeing && <><Switch checked={!!g.shared} onCheckedChange={(v) => set(g.id, { shared: !!v })} aria-label="Share with my manager" />{g.shared ? "Shared with your manager" : "Private: only you see it"}</>}
            </label>
          </div>
        ))}
      </div>
    </Section>
  )
}

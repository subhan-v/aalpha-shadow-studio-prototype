"use client"

import { Check, Clock, Lock, LockOpen, Plus, Trash2, X } from "lucide-react"
import { Meter, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { goalProgress } from "@/lib/client-data"
import { makeGoals } from "@/lib/delivery"
import { fmtLong } from "@/lib/dates"
import { decideGoalChange, goalState } from "@/lib/goals"
import { useStore } from "@/lib/store"
import type { Category, Client, Goal } from "@/lib/types"
import { cn } from "@/lib/utils"

const CATS: Category[] = ["Reporting", "Paid media", "Ops and admin", "Client delivery", "Creative", "Sales"]

export function GoalsTab({ c }: { c: Client }) {
  const { s, update, mutate } = useStore()
  const state = goalState(c)
  const locked = state !== "draft"
  const lock = c.goalLock
  const set = (id: string, patch: Partial<Goal>) => update(c.id, (x) => ({ ...x, goals: x.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
  const drafts = c.goals.filter((g) => g.status === "draft").length

  return (
    <Section title="Goals" sub="Written from the kickoff call. Every workflow and agent is ranked against them in the client's app."
      right={locked ? undefined :
        <div className="flex gap-2">
          {c.goals.length === 0 && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => update(c.id, (x, t) => ({ ...x, goals: makeGoals(x, "draft"), log: [{ date: t, text: "Goals drafted from the template." }, ...x.log] }))}>Start from template</Button>}
          <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => update(c.id, (x) => ({ ...x, goals: [...x.goals, { id: `${x.id}-g${Date.now()}`, title: "New goal", metric: "Hours back a week", target: 5, categories: [], status: "draft" }] }))}><Plus />Add goal</Button>
          {drafts > 0 && <Button size="sm" className="rounded-[10px]" onClick={() => update(c.id, (x, t) => ({ ...x, goals: x.goals.map((g) => ({ ...g, status: "published" })), log: [{ date: t, text: "Goals published to the client." }, ...x.log] }))}>Publish {drafts}</Button>}
        </div>
      }>
      <div className={cn("mb-4 flex flex-wrap items-center gap-3 rounded-2xl border p-3.5 text-sm", state === "pending" && "border-[var(--status-warning)] bg-[var(--watch-bg)]")}>
        {state === "locked" ? <Lock className="size-4 text-[var(--delta-good)]" /> : state === "pending" ? <Clock className="size-4 text-[var(--watch-fg)]" /> : <LockOpen className="size-4 text-[var(--text-muted)]" />}
        <span className="flex-1">
          {state === "draft" && "Draft. The client can edit these in their app and lock them in."}
          {state === "locked" && `Locked by ${lock?.by} on ${fmtLong(lock!.at!)}. Read-only here and in the client's app until a change request is approved.`}
          {state === "pending" && "The client asked to change their locked goals. Approving unlocks them for editing."}
        </span>
        <Pill t={state === "locked" ? "good" : state === "pending" ? "warn" : "muted"}>{state === "locked" ? "Locked" : state === "pending" ? "Change pending" : "Draft"}</Pill>
        {state === "pending" && lock?.pending && (
          <span className="flex gap-2">
            <Button size="sm" className="rounded-[10px]" onClick={() => mutate((p) => decideGoalChange(p, lock.pending!, true))}><Check />Approve and unlock</Button>
            <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => decideGoalChange(p, lock.pending!, false))}><X />Decline</Button>
          </span>
        )}
      </div>
      {c.goals.length === 0 && <p className="py-4 text-sm text-[var(--text-muted)]">No goals yet.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {c.goals.map((g) => {
          const p = goalProgress(c, g, s.today)
          return (
            <div key={g.id} className="flex flex-col gap-3 rounded-2xl border p-4">
              <div className="flex items-start gap-2">
                <Input value={g.title} disabled={locked} onChange={(e) => set(g.id, { title: e.target.value })} aria-label="Goal" className="h-9 flex-1 rounded-[10px] text-sm font-medium" />
                <Pill t={g.status === "published" ? "good" : "muted"}>{g.status === "published" ? "Published" : "Draft"}</Pill>
                {g.priority && <Pill t="info">{g.priority}</Pill>}
                <Button size="icon-sm" variant="ghost" disabled={locked} aria-label="Delete goal" onClick={() => update(c.id, (x) => ({ ...x, goals: x.goals.filter((y) => y.id !== g.id) }))}><Trash2 /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                <span>{g.metric}</span>
                <label className="flex items-center gap-1.5">Target
                  <Input type="number" value={g.target} min={1} disabled={locked} onChange={(e) => set(g.id, { target: Number(e.target.value) })} className="h-8 w-20 rounded-[10px] text-sm" />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATS.map((k) => {
                  const on = g.categories.includes(k)
                  return <button key={k} aria-pressed={on} disabled={locked} onClick={() => set(g.id, { categories: on ? g.categories.filter((x) => x !== k) : [...g.categories, k] })} className={cn("h-7 rounded-full border px-2.5 text-xs", on ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "text-[var(--text-secondary)]")}>{k}</button>
                })}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs"><span className="text-[var(--text-muted)]">Found toward this goal</span><span className="font-medium tabular-nums">{p.found.toFixed(1)} of {g.target} h/wk</span></div>
                <Meter value={p.found} max={Math.max(g.target, p.found)} target={g.target} t={p.found >= g.target ? "good" : "info"} />
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

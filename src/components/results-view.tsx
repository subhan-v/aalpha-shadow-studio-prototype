"use client"

// Results: baseline vs now in time, money and effort, plus how each live agent performs.
// Owners and the Studio see dollars and rates; managers see team-level dollars, never a
// pay rate; members never see this page. Each agent's hours are priced at the rate of the
// people whose work it took over. Anyone can flag an agent that isn't doing its job.

import { useState } from "react"
import { Bot, Clock, DollarSign, Flag, Gauge, Lock, MessageSquareWarning, Users } from "lucide-react"
import { Kpi, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { fmtLong } from "@/lib/dates"
import { newRequest } from "@/lib/requests"
import { results } from "@/lib/results"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

export function ResultsView({ c, view, who }: { c: Client; view: "admin" | "owner" | "manager"; who?: string }) {
  const { s } = useStore()
  const r = results(c, s.today)
  const showRate = view !== "manager"
  const [flagging, setFlagging] = useState<string | null>(null)
  const [flagged, setFlagged] = useState(false)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm">
        <Lock className="size-4 text-[var(--text-muted)]" />
        <span>Baseline locked {r.baseline.date ? fmtLong(r.baseline.date) : "at kickoff"}</span>
        <span className="text-[var(--text-muted)]">· {r.baseline.repeatHrs} h a week of repeat work · {r.baseline.msgShare}% of time in messages · {r.baseline.responseMin} min to answer a client</span>
      </div>

      {r.agents.length === 0 && r.projected.hrsWk > 0 && (
        <div className="rounded-2xl bg-[var(--seq-100)] px-4 py-3 text-sm text-[var(--seq-900)]">Nothing is live yet, so nothing is counted yet. The agents planned so far would give back <b>{r.projected.hrsWk} h a week</b> by day 90{`, worth about `}<b>{usd(r.projected.valueMo)} a month</b>.</div>
      )}
      <div data-tour="results" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Kpi label="Time back" icon={<Clock />} hue="#2a78d6" value={<>{r.time.hrsWk}<span className="text-base font-normal text-[var(--text-muted)]"> h/wk</span></>} note={`${r.time.hrsMo} h a month · ${r.time.fte} full-time people`} />
        <Kpi label="Value a month" icon={<DollarSign />} hue="#1baf7a" value={usd(r.money.valueMo)} note={c.connections.payroll === "none" ? "At an estimated rate until payroll is connected" : showRate ? `Averages $${r.money.rate.rate}/h at your payroll rates` : "From payroll, team level"} />
        <Kpi label="Agents live" icon={<Bot />} hue="#6250d6" value={r.agents.length} note={`Of ${c.agents.length} planned · ${r.projected.hrsWk} h/wk once all are live`} />
        <Kpi label="Room to grow" icon={<Users />} hue="#eda100" value={<>{r.capacity}<span className="text-base font-normal text-[var(--text-muted)]"> more clients</span></>} note="At about 6 h a week each, with the same team" />
      </div>

      <Section title="How we count this" sub="The same steps for every agent, so the numbers can be checked">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Lock the baseline", `At kickoff we measure the work as it is: ${r.baseline.repeatHrs} hours a week of repeat work, timed per run.`],
            ["Count every run", "Each agent run is logged with whether it worked and whether a person had to step in."],
            ["Minutes saved", "Minutes a run before the agent, minus minutes a person still spends on it now."],
            [showRate ? "Hours times the role's rate" : "Hours times payroll", showRate ? "Saved hours are priced at the loaded pay rate of the people who used to do that work." : "Saved hours are priced from your payroll at team level."],
          ].map(([k, v], i) => (
            <li key={k} className="flex flex-col gap-1.5 rounded-2xl bg-[var(--surface-2)] p-4">
              <span className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-6 place-items-center rounded-full bg-[var(--graphite)] text-xs text-white">{i + 1}</span>{k}</span>
              <span className="text-sm text-[var(--text-secondary)]">{v}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Effort" sub="Day 0 against now">
          {r.effort.map((e) => {
            const better = e.before !== null && e.now < e.before
            return (
              <div key={e.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t py-2.5 text-sm first:border-t-0">
                <span>{e.name}</span>
                <span className="tabular-nums text-[var(--text-muted)]">{e.before?.toLocaleString() ?? "–"}</span>
                <span className={`w-16 text-right font-semibold tabular-nums ${better ? "text-[var(--delta-good)]" : ""}`}>{e.now.toLocaleString()}</span>
              </div>
            )
          })}
        </Section>
        <Section title="Growth" sub="Revenue per person and clients per person">
          {c.business?.pods.length ? (() => {
            const pods = c.business!.pods
            const people = pods.reduce((x, y) => x + y.people, 0), clients = pods.reduce((x, y) => x + y.clients, 0), rev = pods.reduce((x, y) => x + y.revenueMo, 0)
            const ams = c.seats.filter((x) => /account (manager|director)/i.test(x.role)).length || 1
            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--surface-2)] p-4"><div className="text-xs text-[var(--text-secondary)]">Clients per account manager</div><div className="text-2xl font-semibold tabular-nums">{(clients / ams).toFixed(1)}</div></div>
                <div className="rounded-2xl bg-[var(--surface-2)] p-4"><div className="text-xs text-[var(--text-secondary)]">Revenue per person, monthly</div><div className="text-2xl font-semibold tabular-nums">${(rev / people / 1000).toFixed(1)}k</div></div>
                <p className="col-span-2 text-xs text-[var(--text-muted)]">From your Business profile. The trend starts once the CRM has a few months of history.</p>
              </div>
            )
          })() : (
            <div className="flex flex-col gap-1 rounded-2xl border border-dashed p-4 text-sm"><span className="font-medium">Not set up yet</span><span className="text-xs text-[var(--text-muted)]">Add your team pods in Settings, Business profile, and connect the CRM to see revenue and clients per person.</span></div>
          )}
        </Section>
      </div>

      <div data-tour="agents"><Section title="How each agent is doing" sub="Measured against the baseline for the work it took over">
        {r.agents.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No agent is live yet.</p> : (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead className="text-right">Runs</TableHead><TableHead className="text-right">Success</TableHead><TableHead className="text-right">Stepped in</TableHead><TableHead className="text-right">Minutes a run</TableHead><TableHead className="text-right">h/wk back</TableHead>{showRate && <TableHead className="text-right">Rate</TableHead>}<TableHead className="text-right">Value / mo</TableHead><TableHead className="text-right">{view === "admin" ? "Feedback" : ""}</TableHead></TableRow></TableHeader>
              <TableBody>
                {r.agents.map((x) => (
                  <TableRow key={x.a.id}>
                    <TableCell><span className="flex items-center gap-2 font-medium"><Bot className="size-4 text-[var(--text-muted)]" />{x.a.name}</span></TableCell>
                    <TableCell className="text-right tabular-nums">{x.runs}</TableCell>
                    <TableCell className="text-right"><Pill t={x.success >= 90 ? "good" : x.success >= 80 ? "warn" : "bad"}>{x.success}%</Pill></TableCell>
                    <TableCell className="text-right tabular-nums">{x.interventions}</TableCell>
                    <TableCell className="text-right tabular-nums"><span className="text-[var(--text-muted)]">{x.minsBefore} → </span>{x.minsAfter}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{x.hrsWk}</TableCell>
                    {showRate && <TableCell className="text-right tabular-nums text-[var(--text-secondary)]">${x.rate}/h</TableCell>}
                    <TableCell className="text-right tabular-nums">{usd(x.valueMo)}</TableCell>
                    <TableCell className="text-right">
                      {view === "admin"
                        ? (x.feedback ? <Pill t="warn"><MessageSquareWarning className="size-3.5" />{x.feedback} open</Pill> : <span className="text-xs text-[var(--text-muted)]">None</span>)
                        : <Button size="xs" variant="ghost" onClick={() => setFlagging(flagging === x.a.id ? null : x.a.id)}><Flag />{x.feedback ? `Flagged (${x.feedback})` : "Not working right?"}</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {flagging && <FlagForm c={c} agentId={flagging} who={who ?? "Owner"} done={(sent) => { setFlagging(null); if (sent) setFlagged(true) }} />}
        {flagged && <p className="mt-3 text-sm text-[var(--delta-good)]">Sent to Aalpha. We&apos;ll look at it and get back to you.</p>}
        {view === "admin" && r.agents.some((x) => x.success < 90) && <p className="mt-3 flex items-center gap-2 text-xs text-[var(--watch-fg)]"><Gauge className="size-3.5" />Below 90% success: check the QA checklist before the next Weekly Progress Update.</p>}
      </Section></div>
    </div>
  )
}

/** The client tells us an agent isn't meeting spec. It lands in Studio as feedback and a request. */
function FlagForm({ c, agentId, who, done }: { c: Client; agentId: string; who: string; done: (sent?: boolean) => void }) {
  const { mutate } = useStore()
  const [text, setText] = useState("")
  const a = c.agents.find((x) => x.id === agentId)!
  return (
    <form className="mt-4 flex flex-col gap-2 rounded-2xl border p-4" onSubmit={(e) => {
      e.preventDefault()
      const note = text.trim()
      if (!note) return
      mutate((p) => {
        const next = newRequest(p, { clientId: c.id, from: `${who} (${c.name})`, source: "Client app", kind: "Bug", title: `${a.name} isn't working right`, detail: note, priority: "High", assignee: c.owner })
        return { ...next, clients: next.clients.map((x) => (x.id === c.id ? { ...x, agentFeedback: [{ id: `${c.id}-fb${Date.now()}`, agentId, at: p.today, who, source: "Client app" as const, text: note, status: "Open" as const }, ...(x.agentFeedback ?? [])], log: [{ date: p.today, text: `${who} flagged ${a.name}: ${note}` }, ...x.log] } : x)) }
      })
      done(true)
    }}>
      <label htmlFor="flag" className="text-sm font-medium">What is {a.name} getting wrong?</label>
      <Textarea id="flag" value={text} onChange={(e) => setText(e.target.value)} placeholder="It used last month's numbers for the Fernwood report." className="min-h-20 rounded-xl text-sm" />
      <div className="flex gap-2 self-end"><Button type="button" variant="ghost" className="rounded-[10px]" onClick={() => done()}>Cancel</Button><Button type="submit" disabled={!text.trim()} className="rounded-[10px]">Send to Aalpha</Button></div>
    </form>
  )
}

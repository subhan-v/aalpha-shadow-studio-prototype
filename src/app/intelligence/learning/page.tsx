"use client"

// Learning (v19): the eval system from build spec Part 4, section 24. AI checks against the
// analysts' examples, number checks on every release, and outcome checks per client.
// Sample scores; the gates are the locked ones (L2).

import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { addDays, fmt, hash } from "@/lib/dates"
import { dayN, hoursBack, hoursFound, projected90 } from "@/lib/engine"
import { useStore } from "@/lib/store"

const TASKS: [string, number, number][] = [
  ["Message type label (ask, answer, approval…)", 300, 85],
  ["Workflow detection", 100, 80],
  ["Request opens and closes", 150, 80],
  ["Slack-to-desktop match", 100, 80],
  ["Identity links", 100, 95],
  ["Roles and teams inferred", 40, 75],
]

export default function LearningPage() {
  const { s } = useStore()
  const t = s.today
  const models = TASKS.map(([task, gold, gate], i) => {
    const score = Math.min(99, Math.round(gate - 8 + hash(task + t.slice(0, 7)) * 16))
    return { task, gold, gate, score, pass: score >= gate, last: fmt(addDays(t, -(i % 3))) }
  })
  const vision = s.sim.pipelineFailing
  const checks: [string, boolean, string][] = [
    ["Fixture truth: every entry matches Larkspur and Northline", true, "13 of 13 entries"],
    ["One number everywhere: page, API, Slack and reports agree", true, "Home, Executive report and My time read the same definitions (L1)"],
    ["Reconciliation: teams sum to people, month = week × 4.33", true, "All clients"],
    ["Privacy: no group under 3, no dollars for members", true, "All endpoints"],
    ["Definitions: never-automate excluded, only live agents count", true, "All clients"],
    ["Stability: no unexplained swing over 25% a week", !vision, vision ? "Desktop numbers held at last good value while vision analysis is behind" : "No flags"],
  ]
  const outcome = s.clients.filter((c) => (dayN(c, t) ?? 0) > 30).map((c) => {
    const found = hoursFound(c, t), proj = projected90(c, t), back = hoursBack(c, t)
    const err = proj ? Math.round(((proj - back) / proj) * 100) : null
    return { c, found, proj: Math.round(proj * 10) / 10, back: Math.round(back * 10) / 10, err }
  })

  return (
    <>
      <PageHeader title="Learning" sub="Is Shadow getting more accurate? AI checks, number checks and outcomes. A failed gate blocks the change or hides the number." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="AI checks passing" value={`${models.filter((m) => m.pass).length}/${models.length}`} t={models.some((m) => !m.pass) ? "warn" : undefined} />
        <Kpi label="Number checks passing" value={`${checks.filter((c) => c[1]).length}/${checks.length}`} t={checks.some((c) => !c[1]) ? "warn" : undefined} />
        <Kpi label="Feedback this demo" value={(s.feedback ?? []).length} note="Becomes training examples after review" />
      </div>
      <Section title="AI checks" sub="Each task scored against examples labelled by Aalpha analysts. A new version goes live only if it beats the live one and no client gets worse.">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader><TableRow><TableHead>Task</TableHead><TableHead className="text-right">Examples</TableHead><TableHead className="text-right">Score</TableHead><TableHead className="text-right">Gate</TableHead><TableHead>Status</TableHead><TableHead>Last run</TableHead></TableRow></TableHeader>
            <TableBody>
              {models.map((m) => <TableRow key={m.task}><TableCell>{m.task}</TableCell><TableCell className="text-right tabular-nums">{m.gold}</TableCell><TableCell className="text-right tabular-nums">{m.score}%</TableCell><TableCell className="text-right tabular-nums">{m.gate}%</TableCell><TableCell><Pill t={m.pass ? "good" : "bad"}>{m.pass ? "Pass" : "Below gate, not promoted"}</Pill></TableCell><TableCell className="tabular-nums">{m.last}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
      </Section>
      <Section title="Number checks" sub="Run on every release and nightly">
        <ul className="flex flex-col text-sm">
          {checks.map(([name, ok, note]) => <li key={name} className="flex flex-wrap items-center gap-3 border-t py-2.5 first:border-t-0"><Pill t={ok ? "good" : "warn"}>{ok ? "Pass" : "Flagged"}</Pill><span className="flex-1">{name}</span><span className="text-xs text-[var(--text-muted)]">{note}</span></li>)}
        </ul>
      </Section>
      <Section title="Outcomes: hours found versus hours back" sub="The proof behind the guarantee. A persistent overestimate lowers that workflow's standard minutes.">
        {outcome.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No client past day 30 yet.</p> : (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader><TableRow><TableHead>Client</TableHead><TableHead className="text-right">Found (h/wk)</TableHead><TableHead className="text-right">Planned back (h/wk)</TableHead><TableHead className="text-right">Actual back (h/wk)</TableHead><TableHead className="text-right">Gap</TableHead></TableRow></TableHeader>
              <TableBody>{outcome.map((o) => <TableRow key={o.c.id}><TableCell>{o.c.name}</TableCell><TableCell className="text-right tabular-nums">{o.found}</TableCell><TableCell className="text-right tabular-nums">{o.proj}</TableCell><TableCell className="text-right tabular-nums">{o.back}</TableCell><TableCell className="text-right tabular-nums">{o.err === null ? "–" : `${o.err}%`}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        )}
      </Section>
      <Section title="Promotions and rollbacks" sub="Every version change, with who approved it">
        <ul className="flex flex-col text-sm">
          <li className="flex flex-wrap gap-x-3 border-t py-2 first:border-t-0"><Pill t="good">Promoted</Pill><span>Workflow detection v4</span><span className="text-[var(--text-muted)]">{fmt(addDays(t, -6))} · +3 points, no client worse · approved by Subhan</span></li>
          <li className="flex flex-wrap gap-x-3 border-t py-2"><Pill t="warn">Rolled back</Pill><span>Message type label v2</span><span className="text-[var(--text-muted)]">{fmt(addDays(t, -11))} · Not right rate rose at 2 clients · automatic</span></li>
          <li className="flex flex-wrap gap-x-3 border-t py-2"><Pill t="muted">Rejected</Pill><span>Request close v3</span><span className="text-[var(--text-muted)]">{fmt(addDays(t, -15))} · below the 80% gate</span></li>
        </ul>
      </Section>
    </>
  )
}

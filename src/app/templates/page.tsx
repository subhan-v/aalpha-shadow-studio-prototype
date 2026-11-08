"use client"

import { PageHeader, Pill, Section } from "@/components/bits"
import { ToolChip } from "@/components/sop-view"
import { CATS } from "@/lib/client-data"
import { makeGoals } from "@/lib/delivery"
import type { Tool } from "@/lib/types"
import { APP } from "@/lib/flags"

const SOPS: [string, Tool[], number][] = [
  ["Build the monthly client report", ["ga", "hubspot", "sheets", "slides", "slack", "gmail"], 9],
  ["Check ad spend and pacing", ["gads", "sheets", "slack"], 5],
  ["Send the weekly client update", ["asana", "docs", "slack", "gmail"], 5],
  ["Set up a new client", ["hubspot", "docs", "asana", "gmail", "slack"], 5],
]
const REPORTS = [["Weekly Progress Update", "Every Friday, to the client's shared channel"], ["Monthly scorecard", "Days 30 and 60, then monthly"], ["CEO summary", "On request"], ["Day-90 report", "Day 85 to 90"]]
const SETS = [["Digital marketing agency", CATS.join(", ")], ["Creative studio", "Creative, Client delivery, Ops and admin, Sales"], ["Paid media shop", "Paid media, Reporting, Client delivery, Sales"]]

/** Shared starting points so one specialist can run several clients the same way. */
export default function Templates() {
  return (
    <>
      <PageHeader title="Templates" sub="Starting points for every new client. Editing comes later." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Work categories" sub="Picked per client at setup">
          {SETS.map(([n, c]) => <div key={n} className="flex flex-col gap-0.5 border-t py-2.5 first:border-t-0"><span className="text-sm font-medium">{n}</span><span className="text-xs text-[var(--text-muted)]">{c}</span></div>)}
        </Section>
        <Section title="Goals" sub="Drafted from the kickoff call">
          {makeGoals({ id: "t" }, "draft").map((g) => <div key={g.id} className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0"><span className="text-sm font-medium">{g.title}</span><span className="text-xs text-[var(--text-muted)]">{g.target} h/wk</span></div>)}
        </Section>
        <Section title="SOPs" sub={`Step banks ${APP} fills from what it sees`}>
          {SOPS.map(([n, tools, steps]) => <div key={n} className="flex flex-col gap-1.5 border-t py-2.5 first:border-t-0"><span className="flex items-center justify-between text-sm font-medium">{n}<span className="text-xs font-normal text-[var(--text-muted)]">{steps} steps</span></span><span className="flex flex-wrap gap-1">{tools.map((t) => <ToolChip key={t} t={t} compact />)}</span></div>)}
        </Section>
        <Section title="Reports" sub="Drafted from data, approved before sending">
          {REPORTS.map(([n, w]) => <div key={n} className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0"><span className="text-sm font-medium">{n}</span><Pill t="muted">{w}</Pill></div>)}
        </Section>
      </div>
    </>
  )
}

"use client"

// Insight Lab (v19): how a new insight goes from idea to live, and the queue of insights the
// system suggests on its own from six signals. Nothing ships without an analyst's approval.

import { useState } from "react"
import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { hash } from "@/lib/dates"
import { CATALOGUE, LAB, type Stage } from "@/lib/insights"
import { useStore } from "@/lib/store"

const STAGES: { id: Stage; done: string }[] = [
  { id: "Draft", done: "The entry validates against the metrics layer" },
  { id: "Back-test", done: "90 days run for every client; an analyst checks a sample" },
  { id: "Beta", done: "Live for 1 or 2 clients; useful rate at or above median after 2 weeks" },
  { id: "Live", done: "All clients at the depth it needs" },
  { id: "Retired", done: "Low useful or high Not right for a month" },
]

type Suggestion = { id: string; signal: string; text: string; evidence: string }

export default function LabPage() {
  const { s } = useStore()
  const [handled, setHandled] = useState<Record<string, "Drafted" | "Dismissed">>({})
  const reportAsks = s.requests.filter((r) => r.kind === "Report" || r.source === "Report request")
  const asked = s.clients.flatMap((c) => c.reports.filter((r) => r.kind === "custom").map((r) => ({ c: c.name, q: r.title })))
  const SUG: Suggestion[] = [
    { id: "q", signal: "Questions nobody could answer", text: asked[0] ? `Answer "${asked[0].q}" as a card` : "Time spent per agency client account", evidence: `${asked.length + reportAsks.length} ${asked.length + reportAsks.length === 1 ? "question" : "questions"} from report requests and the Ask box with no matching insight` },
    { id: "custom", signal: "Custom report built by hand twice", text: "Time spent per agency client account", evidence: "2 clients asked; a Specialist built it in a sheet both times" },
    { id: "cross", signal: "Same confirmed finding across clients", text: "Monday spend pull copied into client decks", evidence: "Confirmed at 4 clients in the last 30 days" },
    { id: "jump", signal: "A metric far from a client's normal", text: "Approval reply time doubled", evidence: `Reply time up ${Math.round(80 + hash(s.today) * 60)}% in 2 weeks at one client` },
    { id: "outcome", signal: "Behavior that predicts an outcome", text: "Founder pull falling predicts renewal", evidence: "Clients whose founder pull fell 20%+ renewed; rising after-hours chains preceded 2 of 3 churns" },
    { id: "wrong", signal: "An insight that keeps getting Not right", text: `Reword "${CATALOGUE.find((e) => e.id === "repeat-asks")!.question}" for pod-run agencies`, evidence: "Not right rate 2x the catalogue median at pod-run clients" },
  ]
  const open = SUG.filter((x) => !handled[x.id])

  return (
    <>
      <PageHeader title="Insight Lab" sub="New insights start here. The system suggests some on its own; an analyst approves every one before a client sees it." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Suggestions to review" value={open.length} />
        <Kpi label="In draft or back-test" value={LAB.filter((x) => x.stage === "Draft" || x.stage === "Back-test").length} />
        <Kpi label="In beta" value={CATALOGUE.filter((e) => e.stage === "Beta").length} />
      </div>
      <Section title="Suggested by the system" sub="Six signals say an insight is missing or weak. Draft turns one into an entry; nothing ships on its own.">
        <div className="flex flex-col">
          {SUG.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs text-[var(--text-muted)]">{x.signal}</span>
                <span className="text-sm font-medium">{x.text}</span>
                <span className="text-xs text-[var(--text-secondary)]">{x.evidence}</span>
              </div>
              {handled[x.id]
                ? <Pill t={handled[x.id] === "Drafted" ? "good" : "muted"}>{handled[x.id]}</Pill>
                : <div className="flex gap-2"><Button size="sm" className="rounded-[10px]" onClick={() => setHandled({ ...handled, [x.id]: "Drafted" })}>Start a draft</Button><Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setHandled({ ...handled, [x.id]: "Dismissed" })}>Dismiss</Button></div>}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Pipeline" sub="Every entry moves through the same five stages">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {STAGES.map((st) => {
            const list = [...LAB.filter((x) => x.stage === st.id).map((x) => ({ q: x.question, n: x.note })), ...CATALOGUE.filter((e) => e.stage === st.id).map((e) => ({ q: e.question, n: `Definition ${e.version}` }))]
            return (
              <div key={st.id} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-[var(--surface-2)] p-3">
                <div className="flex items-center justify-between"><span className="text-sm font-semibold">{st.id}</span><span className="text-xs tabular-nums text-[var(--text-muted)]">{list.length}</span></div>
                <span className="text-xs text-[var(--text-muted)]">Done when: {st.done}</span>
                {list.map((x) => <div key={x.q} className="rounded-xl border bg-card p-2.5 text-xs"><span className="block font-medium">{x.q}</span><span className="text-[var(--text-muted)]">{x.n}</span></div>)}
              </div>
            )
          })}
        </div>
      </Section>
    </>
  )
}

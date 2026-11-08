"use client"

// Catalogue (v19): every insight clients can see, defined once (build spec Part 4). Who sees it,
// the sources it needs, its definition version, how many clients it's live on, and how people
// rate it. Feedback clicked on client cards lands here.

import { useState } from "react"
import { Kpi, PageHeader, Pill, Section, Segmented } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CATALOGUE, DEPTH_LABEL, feedbackStats, liveOn, type Audience } from "@/lib/insights"
import { useStore } from "@/lib/store"

export default function CataloguePage() {
  const { s } = useStore()
  const [aud, setAud] = useState<"All" | Audience>("All")
  const rows = CATALOGUE.filter((e) => aud === "All" || e.audience.includes(aud)).map((e) => ({ e, f: feedbackStats(s, e.id), on: liveOn(s, e) }))
  const median = [...rows.map((r) => r.f.usefulRate)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0
  const recent = [...(s.feedback ?? [])].reverse().slice(0, 8)

  return (
    <>
      <PageHeader title="Catalogue" sub="Every insight a client can see. One definition each; no client page computes its own number."
        right={<Segmented label="Audience" value={aud} onChange={(v) => setAud(v as typeof aud)} options={["All", "CEO", "Manager", "Staff"].map((x) => ({ id: x, label: x }))} />} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Insights live or in beta" value={CATALOGUE.filter((e) => e.stage === "Live" || e.stage === "Beta").length} />
        <Kpi label="Median useful rate" value={`${median}%`} note="Useful or Already handled" />
        <Kpi label="Feedback from this demo" value={(s.feedback ?? []).length} note="Clicks on client cards" />
      </div>
      <Section title="Entries" sub={`An entry below the median useful rate for a month goes back to beta. Median now ${median}%.`}>
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader><TableRow><TableHead>Question it answers</TableHead><TableHead>Audience</TableHead><TableHead>Needs</TableHead><TableHead>Stage</TableHead><TableHead>Version</TableHead><TableHead className="text-right">Live on</TableHead><TableHead className="text-right">Useful</TableHead><TableHead className="text-right">Not right</TableHead><TableHead className="text-right">Acted on</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(({ e, f, on }) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[320px]"><span className="block font-medium">{e.question}</span><span className="block text-xs text-[var(--text-muted)]">{e.how}</span></TableCell>
                  <TableCell>{e.audience.join(", ")}{e.money && <span className="block text-xs text-[var(--text-muted)]">Dollars: owners only</span>}</TableCell>
                  <TableCell className="text-xs">{DEPTH_LABEL[e.depth]}</TableCell>
                  <TableCell><Pill t={e.stage === "Live" ? "good" : e.stage === "Beta" ? "info" : "muted"}>{e.stage}</Pill></TableCell>
                  <TableCell className="font-mono text-xs">{e.version}</TableCell>
                  <TableCell className="text-right tabular-nums">{on} of {s.clients.length}</TableCell>
                  <TableCell className={`text-right tabular-nums ${f.usefulRate < median ? "text-[var(--watch-fg)]" : ""}`}>{f.usefulRate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{f.wrongRate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{f.act}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
      <Section title="Latest feedback" sub="From client cards in this demo">
        {recent.length === 0
          ? <p className="text-sm text-[var(--text-muted)]">Nothing yet. Open a client app, go to Home and use the buttons under any card.</p>
          : <ul className="flex flex-col text-sm">{recent.map((f) => <li key={f.id} className="flex flex-wrap gap-x-3 border-t py-2 first:border-t-0"><span className="font-medium">{f.action}</span><span>{f.insightId.startsWith("wf:") ? `Member check: ${s.clients.find((c) => c.id === f.clientId)?.workflows.find((w) => `wf:${w.id}` === f.insightId)?.name ?? "a finding"}` : CATALOGUE.find((e) => e.id === f.insightId)?.question}</span><span className="text-[var(--text-muted)]">{f.by} ({f.role}) · {s.clients.find((c) => c.id === f.clientId)?.name} · {f.version}</span></li>)}</ul>}
      </Section>
    </>
  )
}

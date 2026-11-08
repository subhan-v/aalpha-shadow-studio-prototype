"use client"

// Studio > Agent health: agents that may not be meeting spec, with what the client said.
// Send one to the dev team in Linear, or mark the feedback resolved once it is fixed.

import Link from "next/link"
import { Bot, Check, MessageSquareWarning, Send } from "lucide-react"
import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { agentHealth } from "@/lib/agent-health"
import { fmt } from "@/lib/dates"
import { newRequest, sendToLinear } from "@/lib/requests"
import { useStore } from "@/lib/store"
import type { State } from "@/lib/types"

function setFeedback(p: State, clientId: string, agentId: string, status: "Sent to Linear" | "Resolved", note: string): State {
  return { ...p, clients: p.clients.map((c) => (c.id === clientId ? { ...c, agentFeedback: (c.agentFeedback ?? []).map((f) => (f.agentId === agentId && f.status !== "Resolved" ? { ...f, status } : f)), log: [{ date: p.today, text: note }, ...c.log] } : c)) }
}

export default function AgentHealth() {
  const { s, mutate } = useStore()
  const rows = agentHealth(s)
  const flagged = rows.filter((r) => r.signals.length)
  return (
    <>
      <PageHeader title="Agent health" sub="Live agents that may not be meeting spec, with what the client told us. Fix it, or send it to the dev team." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<Bot />} hue="#e5484d" label="Agents flagged" value={flagged.length} t={flagged.length ? "bad" : undefined} />
        <Kpi icon={<MessageSquareWarning />} hue="#eb6834" label="Open complaints" value={rows.reduce((n, r) => n + r.open.length, 0)} note="From the client app and Slack" />
        <Kpi icon={<Check />} hue="#1baf7a" label="Resolved" value={rows.reduce((n, r) => n + r.fb.filter((f) => f.status === "Resolved").length, 0)} />
      </div>
      <Section title="Needs a look" sub={`${flagged.length} agents`}>
        {flagged.length === 0 && <p className="text-sm text-[var(--text-muted)]">Every live agent is within spec.</p>}
        {flagged.map(({ c, x, open, signals }) => (
          <div key={x.a.id} className="flex flex-col gap-3 border-t py-4 first:border-t-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex min-w-48 flex-1 flex-col"><span className="font-medium">{x.a.name}</span><Link href={`/clients/${c.id}?tab=results`} className="text-xs text-[var(--text-muted)] hover:underline">{c.name} · {x.runs} runs · {x.hrsWk} h/wk back</Link></span>
              <span className="flex flex-wrap gap-1.5">{signals.map((g) => <Pill key={g} t={g.startsWith("Success") ? "bad" : "warn"}>{g}</Pill>)}</span>
            </div>
            {open.map((f) => <p key={f.id} className="rounded-xl bg-[var(--surface-2)] p-3 text-sm">&ldquo;{f.text}&rdquo; <span className="text-xs text-[var(--text-muted)]">{f.who} · {f.source} · {fmt(f.at)}{f.status === "Sent to Linear" ? " · with the dev team" : ""}</span></p>)}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="rounded-[10px]" disabled={open.length > 0 && open.every((f) => f.status === "Sent to Linear")} onClick={() => mutate((p) => {
                const withReq = newRequest(p, { clientId: c.id, from: "Agent health", source: "Team", kind: "Bug", title: `${x.a.name} not meeting spec (${c.name})`, detail: [...signals, ...open.map((f) => `"${f.text}" (${f.who})`)].join(". "), priority: "High", assignee: "Hashim" })
                return setFeedback(sendToLinear(withReq, withReq.requests[0].id), c.id, x.a.id, "Sent to Linear", `${x.a.name} sent to the dev team from Agent health.`)
              })}><Send />Send to Linear</Button>
              {open.length > 0 && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => setFeedback(p, c.id, x.a.id, "Resolved", `Feedback on ${x.a.name} resolved.`))}><Check />Mark resolved</Button>}
            </div>
          </div>
        ))}
      </Section>
      {rows.some((r) => !r.signals.length) && (
        <Section title="Resolved" sub="Feedback we closed">
          {rows.filter((r) => !r.signals.length).flatMap((r) => r.fb.map((f) => <p key={f.id} className="border-t py-2 text-sm first:border-t-0">{r.x.a.name} · {r.c.name}: &ldquo;{f.text}&rdquo; <span className="text-xs text-[var(--text-muted)]">{f.who} · {fmt(f.at)}</span></p>))}
        </Section>
      )}
    </>
  )
}

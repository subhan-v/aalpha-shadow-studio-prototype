"use client"

// For members: a clear checklist to get set up, and the repeat work Shadow found in their own
// role, with the SOP for it when there is one. Hours only, never dollars.

import { useState } from "react"
import { Bot, ChevronDown } from "lucide-react"
import { CatBubble, Pill, Section } from "@/components/bits"
import { SopView } from "@/components/sop-view"
import { WK_TO_MO } from "@/lib/client-data"
import { personStats } from "@/lib/people"
import { newRequest } from "@/lib/requests"
import { useStore } from "@/lib/store"
import type { Client, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"


// An agent covers a workflow when they share a meaningful word ("Rank tracking roundup").
const GENERIC = new Set(["client", "clients", "weekly", "monthly", "written", "once", "from"])
const words = (x: string) => x.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !GENERIC.has(w)).map((w) => w.replace(/s$/, ""))
const sameWork = (a: string, b: string) => words(a).some((w) => words(b).includes(w))

export function MyWorkflows({ c, me }: { c: Client; me: Seat }) {
  const { s, mutate } = useStore()
  // Members check their own findings: "That's right" or "Not quite" lands in the feedback store,
  // so a wrong finding is fixed on their side before anyone acts on it.
  const said = (wid: string) => [...(s.feedback ?? [])].reverse().find((f) => f.clientId === c.id && f.insightId === `wf:${wid}` && f.by === me.name)?.action
  const verify = (wid: string, ok: boolean) => mutate((p) => {
    const next = { ...p, feedback: [...(p.feedback ?? []), { id: `fb${Date.now()}`, clientId: c.id, insightId: `wf:${wid}`, action: ok ? "Useful" as const : "Not right" as const, by: me.name, role: "Member", at: p.today, version: "wf" }] }
    // "Not quite" really reaches Subhan: it opens a request, as the copy promises.
    const w = c.workflows.find((x) => x.id === wid)
    return ok ? next : newRequest(next, { clientId: c.id, from: me.name, source: "Member", kind: "Change", title: `Finding not quite right: ${w?.name ?? wid}`, detail: `${me.name} says this finding about their work isn't quite right.`, priority: "Normal", assignee: "Subhan" })
  })
  const p = personStats(c, me, s.today)
  const [open, setOpen] = useState<string | null>(null)
  // Each agent is matched to one workflow at most (the biggest it fits), so the count of
  // "Agent helping" never exceeds the agents actually working for this person.
  const matched = new Map<string, (typeof p.agents)[number]>()
  for (const w of p.workflows) {
    const a = p.agents.find((x) => x.category === w.category && sameWork(x.name, w.name) && ![...matched.values()].includes(x))
    if (a) matched.set(w.id, a)
  }
  if (!p.workflows.length) return <Section title="Your repeat work" sub="From your own work"><p className="text-sm text-[var(--text-muted)]">Nothing repeatable found in your role yet. It shows up after your first week of data.</p></Section>
  return (
    <div data-tour="myflows" className="flex flex-col gap-4">
      <p className="text-sm text-[var(--text-secondary)]">The repeat work Shadow found in your role. Agents are taking {p.backWk} hours a week of it off your plate. Is each one right? Your answer goes to Subhan and fixes the finding before anyone acts on it.</p>
      {p.workflows.map((w) => {
        const sop = c.sops.find((x) => x.workflowId === w.id && x.status === "published")
        const agent = matched.get(w.id)
        return (
          <div key={w.id} className="rounded-[var(--radius-card)] border bg-card">
            <button onClick={() => setOpen(open === w.id ? null : w.id)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
              <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="font-medium">{w.name}</span><span className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]"><CatBubble c={w.category} />{Math.round((w.hoursWk / Math.max(1, w.people)) * WK_TO_MO)} h a month for you · done {w.ways} {w.ways === 1 ? "way" : "ways"}</span></span>
              {agent && <Pill t={p.live.includes(agent) ? "good" : "muted"}><Bot className="size-3.5" />{p.live.includes(agent) ? "Agent helping" : "Agent coming"}</Pill>}
              {sop && <span className="flex items-center gap-1 text-sm font-medium text-[var(--bronze)]">SOP<ChevronDown className={cn("size-4 transition", open === w.id && "rotate-180")} /></span>}
            </button>
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Is this right?</span>
              {said(w.id)
                ? <span className="text-xs font-medium text-[var(--delta-good)]">{said(w.id) === "Useful" ? "You confirmed this" : "Sent to Subhan to fix"}</span>
                : <><button onClick={() => verify(w.id, true)} className="h-7 rounded-full border px-2.5 text-xs hover:bg-[var(--surface-2)]">That&apos;s right</button><button onClick={() => verify(w.id, false)} className="h-7 rounded-full border px-2.5 text-xs hover:bg-[var(--surface-2)]">Not quite</button></>}
            </div>
            {open === w.id && sop && <div className="border-t p-4"><SopView sop={sop} wf={w} /></div>}
          </div>
        )
      })}
    </div>
  )
}

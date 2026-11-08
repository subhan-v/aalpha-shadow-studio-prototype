"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, ExternalLink, Plus, RefreshCw, Send, X } from "lucide-react"
import { Kpi, PageHeader, Pill, Section, Segmented } from "@/components/bits"
import { PersonPicker } from "@/components/person-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fmt } from "@/lib/dates"
import { ageDays, decideDeletion, isOpen, newRequest, OPEN, patchRequest, sendToLinear, syncLinear } from "@/lib/requests"
import { decideGoalChange } from "@/lib/goals"
import { useStore } from "@/lib/store"
import type { Request } from "@/lib/types"
import { cn } from "@/lib/utils"

const KIND_C: Record<Request["kind"], string> = { Question: "#2a78d6", Bug: "#e5484d", Change: "#6250d6", "Data deletion": "#eb6834", Report: "#1baf7a" }

export default function Requests() {
  const { s, mutate } = useStore()
  const [view, setView] = useState("open")
  const [open, setOpen] = useState<string | null>(s.requests[0]?.id ?? null)
  const [reply, setReply] = useState("")
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState("")
  const list = s.requests.filter((r) => (view === "open" ? isOpen(r) : view === "linear" ? !!r.linear : view === "done" ? r.status === "Done" || r.status === "Declined" : true))
  const r = s.requests.find((x) => x.id === open) ?? null
  const client = (id: string | null) => s.clients.find((c) => c.id === id)

  return (
    <>
      <PageHeader title="Requests" sub="Everything coming in: client asks, help, deletion requests, alerts and team notes. Anything for the dev team goes to Linear from here."
        right={<Button className="h-10 rounded-xl" onClick={() => setAdding(!adding)}><Plus />New request</Button>} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Open" value={s.requests.filter(isOpen).length} />
        <Kpi label="Urgent" value={s.requests.filter((x) => x.priority === "Urgent" && OPEN.includes(x.status)).length} t="bad" />
        <Kpi label="Waiting on approval" value={s.requests.filter((x) => x.status === "Waiting on approval").length} t="warn" note="Deletion requests" />
        <Kpi label="With the dev team" value={s.requests.filter((x) => x.linear && x.linear.state !== "Done").length} note="Open in Linear" />
      </div>
      {adding && (
        <Section title="New request" sub="For something the team noticed. Clients and members raise theirs from the app.">
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; mutate((p) => newRequest(p, { clientId: null, from: p.me, source: "Team", kind: "Change", title: title.trim(), detail: "", priority: "Normal", assignee: p.me })); setTitle(""); setAdding(false) }}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing" className="h-10 flex-1 rounded-xl" />
            <Button type="submit" className="h-10 rounded-xl">Add</Button>
          </form>
        </Section>
      )}
      <Segmented label="View" value={view} onChange={setView} options={[{ id: "open", label: "Open" }, { id: "linear", label: "In Linear" }, { id: "done", label: "Closed" }, { id: "all", label: "All" }]} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
          {list.length === 0 && <p className="p-6 text-sm text-[var(--text-muted)]">Nothing here.</p>}
          {list.map((x) => (
            <button key={x.id} onClick={() => setOpen(x.id)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t px-5 py-3.5 text-left first:border-t-0 hover:bg-[var(--surface-2)]", open === x.id && "bg-[var(--seq-100)]")}>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium" style={{ background: `color-mix(in oklch, ${KIND_C[x.kind]}, white 86%)`, color: `color-mix(in oklch, ${KIND_C[x.kind]}, black 35%)` }}><span className="size-1.5 rounded-full" style={{ background: KIND_C[x.kind] }} />{x.kind}</span>
                  {x.priority !== "Normal" && <Pill t={x.priority === "Urgent" ? "bad" : "warn"}>{x.priority}</Pill>}
                  {x.linear && <span className="font-mono text-xs text-[var(--text-muted)]">{x.linear.id}</span>}
                </span>
                <span className="truncate text-sm font-medium">{x.title}</span>
                <span className="text-xs text-[var(--text-muted)]">{client(x.clientId)?.name ?? "Internal"} · {x.from} · {ageDays(x.created, s.today) === 0 ? "today" : `${ageDays(x.created, s.today)}d ago`}</span>
              </span>
              <span className="flex flex-col items-end gap-1.5"><Pill t={x.status === "Done" ? "good" : x.status === "Declined" ? "muted" : x.status === "Sent to Linear" ? "info" : x.status === "Waiting on approval" ? "warn" : "muted"}>{x.status}</Pill><span className="text-xs text-[var(--text-muted)]">{x.assignee}</span></span>
            </button>
          ))}
        </section>

        {r && (
          <Section title={r.title} sub={`${r.kind} · from ${r.from} · ${fmt(r.created)}`}>
            <div className="flex flex-col gap-4">
              {r.detail && <p className="rounded-xl bg-[var(--surface-2)] p-3 text-sm leading-relaxed">{r.detail}</p>}
              {r.action === "unlock-goals" && OPEN.includes(r.status) && <p className="text-xs text-[var(--text-secondary)]">The client&apos;s goals are locked. Approving unlocks them so the client can edit and lock them again. Declining keeps them as they are.</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                {r.clientId && <Link href={`/clients/${r.clientId}`} className="inline-flex h-8 items-center gap-1 rounded-[10px] border px-2.5 hover:bg-[var(--surface-2)]">{client(r.clientId)?.name}<ExternalLink className="size-3" /></Link>}
                <PersonPicker label="Assignee" value={r.assignee} onChange={(v) => mutate((p) => patchRequest(p, r.id, { assignee: v }, `Assigned to ${v}.`))} />
              </div>

              {r.linear ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                  <span className="flex flex-col"><span className="font-mono text-sm font-medium">{r.linear.id}</span><span className="text-xs text-[var(--text-muted)]">Dev team ticket in Linear</span></span>
                  <span className="flex items-center gap-2"><Pill t={r.linear.state === "Done" ? "good" : r.linear.state === "In progress" ? "info" : "muted"}>{r.linear.state}</Pill>{r.linear.state !== "Done" && <Button size="sm" variant="ghost" title="Simulates the Linear webhook" onClick={() => mutate((p) => syncLinear(p, r.id))}><RefreshCw />Sync</Button>}</span>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {r.action === "unlock-goals" && OPEN.includes(r.status) ? (
                  <>
                    <Button size="sm" className="rounded-[10px]" onClick={() => mutate((p) => decideGoalChange(p, r.id, true))}><Check />Approve and unlock goals</Button>
                    <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => decideGoalChange(p, r.id, false))}><X />Decline</Button>
                  </>
                ) : r.kind === "Data deletion" && r.status === "Waiting on approval" ? (
                  <>
                    <Button size="sm" className="rounded-[10px]" onClick={() => mutate((p) => decideDeletion(p, r.id, true))}><Check />Approve deletion</Button>
                    <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => decideDeletion(p, r.id, false))}><X />Decline</Button>
                  </>
                ) : (
                  <>
                    {!r.linear && OPEN.includes(r.status) && <Button size="sm" className="rounded-[10px]" onClick={() => mutate((p) => sendToLinear(p, r.id))}><Send />Send to Linear</Button>}
                    {r.status === "New" && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => patchRequest(p, r.id, { status: "In progress" }, "Picked up."))}>Start</Button>}
                    {OPEN.includes(r.status) && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => patchRequest(p, r.id, { status: "Done" }, "Closed."))}>Mark done</Button>}
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t pt-3">
                <span className="text-xs text-[var(--text-muted)]">Thread</span>
                {r.thread.length === 0 && <span className="text-xs text-[var(--text-muted)]">No replies yet.</span>}
                {r.thread.map((m, i) => <div key={i} className="rounded-xl bg-[var(--surface-2)] p-2.5 text-sm"><span className="text-xs text-[var(--text-muted)]">{m.who} · {fmt(m.at)}</span><p>{m.text}</p></div>)}
                <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; mutate((p) => patchRequest(p, r.id, {}, reply.trim())); setReply("") }}>
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={r.clientId ? "Reply (the client sees this in their app)" : "Add a note"} className="min-h-20 rounded-xl text-sm" />
                  <Button type="submit" size="sm" variant="outline" className="self-end rounded-[10px]">Send reply</Button>
                </form>
              </div>
            </div>
          </Section>
        )}
      </div>
    </>
  )
}

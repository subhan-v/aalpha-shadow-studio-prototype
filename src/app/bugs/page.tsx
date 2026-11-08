"use client"

// Bugs: every bug in one list, mirrored both ways with Linear. Severity sets the response time;
// Linear owns the status (a webhook in the real build, a button here). A bug a client reported is
// answered in their Slack thread when it ships.

import Link from "next/link"
import { useState } from "react"
import { Bug as BugIcon, CheckCircle2, ExternalLink, FlaskConical, Plus, RefreshCw } from "lucide-react"
import { Kpi, PageHeader, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AREAS, isOpenBug, late, linearUpdated, markTested, newBug, SEVERITY } from "@/lib/bugs"
import { diffDays, fmt } from "@/lib/dates"
import { useStore } from "@/lib/store"
import type { Bug } from "@/lib/types"

const SEV_T = { P0: "bad", P1: "warn", P2: "info", P3: "muted" } as const
const ST_T = { Triage: "warn", Todo: "muted", "In progress": "info", "In review": "info", Done: "good", Canceled: "muted" } as const
const sel = "h-9 rounded-[10px] border bg-card px-2 text-sm"

export default function BugsPage() {
  const { s, mutate } = useStore()
  const all = s.bugs ?? []
  const [sev, setSev] = useState("all")
  const [state, setState] = useState("open")
  const [area, setArea] = useState("all")
  const [client, setClient] = useState("all")
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const name = (id: string | null) => (id ? s.clients.find((c) => c.id === id)?.name ?? "Removed client" : "Platform")
  const openBugs = all.filter(isOpenBug)
  const list = all
    .filter((b) => (state === "open" ? isOpenBug(b) : state === "closed" ? !isOpenBug(b) : true) && (sev === "all" || b.severity === sev) && (area === "all" || b.area === area) && (client === "all" || (client === "platform" ? !b.clientId : b.clientId === client)))
    .sort((a, b) => a.severity.localeCompare(b.severity) || a.reported.localeCompare(b.reported))
  const overdue = openBugs.filter((b) => late(b, s.today))
  const oldest = openBugs.reduce((n, b) => Math.max(n, diffDays(s.today, b.reported)), 0)
  const untested = all.filter((b) => b.status === "Done" && !b.testAdded).length

  return (
    <>
      <PageHeader title="Bugs" sub="Every bug, mirrored with Linear. Linear owns the status; a fix closes here when it ships."
        right={<Button className="h-10 rounded-xl" onClick={() => setAdding(!adding)}><Plus />New bug</Button>} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {(["P0", "P1", "P2", "P3"] as const).map((k) => {
          const n = openBugs.filter((b) => b.severity === k).length
          return <Kpi key={k} label={`${k} open`} value={n} note={`${SEVERITY[k].label} · ${SEVERITY[k].within}`} t={n && (k === "P0" || k === "P1") ? "bad" : undefined} />
        })}
        <Kpi label="Past response time" value={overdue.length} note={`Oldest open: ${oldest} ${oldest === 1 ? "day" : "days"}`} t={overdue.length ? "bad" : undefined} />
        <Kpi label="Fixed without a test" value={untested} note="Every fix should add one" t={untested ? "warn" : undefined} />
      </div>

      {adding && <NewBug done={() => setAdding(false)} />}

      <div className="flex flex-wrap items-end gap-2">
        <select aria-label="Status" value={state} onChange={(e) => setState(e.target.value)} className={sel}><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select>
        <select aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)} className={sel}><option value="all">Every severity</option>{(["P0", "P1", "P2", "P3"] as const).map((k) => <option key={k} value={k}>{k} · {SEVERITY[k].label}</option>)}</select>
        <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className={sel}><option value="all">Every area</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        <select aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)} className={sel}><option value="all">Every client</option><option value="platform">Platform</option>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>

      <Section title={`${list.length} ${list.length === 1 ? "bug" : "bugs"}`} sub="Most severe first, then oldest">
        {list.length === 0 ? <p className="py-4 text-sm text-[var(--text-secondary)]">No bugs match these filters.</p> : (
          <div className="flex flex-col">
            {list.map((b) => (
              <div key={b.id} className="border-t first:border-t-0">
                <button onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id} className="grid w-full grid-cols-[56px_minmax(0,1fr)] items-start gap-3 py-3 text-left hover:bg-[var(--surface-2)] sm:grid-cols-[56px_minmax(0,1fr)_auto]">
                  <Pill t={SEV_T[b.severity]}>{b.severity}</Pill>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{b.title}</span>
                    <span className="text-xs text-[var(--text-muted)]">{b.linearId} · {name(b.clientId)} · {b.area} · {b.source} · {b.assignee} · reported {fmt(b.reported)}{late(b, s.today) && <span className="text-[var(--delta-bad)]"> · past {SEVERITY[b.severity].within.toLowerCase()}</span>}</span>
                  </span>
                  <span className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1 sm:justify-end">
                    {b.release && <Pill t="muted">{b.release}</Pill>}
                    {b.status === "Done" && (b.testAdded ? <Pill t="good"><FlaskConical className="size-3" />Test</Pill> : <Pill t="warn">No test</Pill>)}
                    <Pill t={ST_T[b.status]}>{b.status}</Pill>
                  </span>
                </button>
                {open === b.id && <Detail b={b} client={name(b.clientId)} />}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Response times" sub="Severity decides how fast a bug is fixed">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["P0", "P1", "P2", "P3"] as const).map((k) => <div key={k} className="flex flex-col gap-1 rounded-xl bg-[var(--surface-2)] p-3"><Pill t={SEV_T[k]} className="w-fit">{k}</Pill><span className="text-sm font-medium">{SEVERITY[k].label}</span><span className="text-xs text-[var(--text-secondary)]">{SEVERITY[k].within}</span></div>)}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Prototype: Linear isn&apos;t connected. &quot;Linear updated&quot; stands in for the webhook that moves a bug when its Linear issue changes.</p>
      </Section>
    </>
  )

  function Detail({ b, client }: { b: Bug; client: string }) {
    return (
      <div className="mb-3 grid gap-3 rounded-2xl bg-[var(--surface-2)] p-4 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          {b.detail && <p>{b.detail}</p>}
          <span className="text-xs text-[var(--text-muted)]">Client: {b.clientId ? <Link className="hover:underline" href={`/clients/${b.clientId}`}>{client}</Link> : "Platform"}{b.requestId && <> · from a <Link className="hover:underline" href="/requests">request</Link></>}{b.clientRaised && " · reported by the client"}</span>
          {b.reply && <div className="flex gap-2 rounded-xl border bg-card p-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--delta-good)]" /><span><span className="block text-xs text-[var(--text-muted)]">Sent to their Slack thread</span>{b.reply}</span></div>}
          <div className="flex flex-wrap gap-2">
            {isOpenBug(b) && <Button size="sm" className="rounded-[10px]" onClick={() => mutate((p) => linearUpdated(p, b.id))}><RefreshCw />Linear updated</Button>}
            {b.status === "Done" && !b.testAdded && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => mutate((p) => markTested(p, b.id))}><FlaskConical />Regression test added</Button>}
            <span className="inline-flex h-8 items-center gap-1 text-xs text-[var(--text-muted)]"><ExternalLink className="size-3.5" />{b.linearId} in Linear (not connected in the prototype)</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-[var(--text-secondary)]">History</span>
          {b.history.length === 0 ? <span className="text-xs text-[var(--text-muted)]">From the v18 QA pass.</span> : b.history.map((h, i) => <span key={i} className="text-xs"><span className="font-mono text-[var(--text-muted)]">{fmt(h.at)}</span> {h.text}</span>)}
        </div>
      </div>
    )
  }
}

function NewBug({ done }: { done: () => void }) {
  const { s, mutate } = useStore()
  const [title, setTitle] = useState("")
  const [detail, setDetail] = useState("")
  const [clientId, setClientId] = useState("")
  const [area, setArea] = useState<Bug["area"]>("Client app")
  const [severity, setSeverity] = useState<Bug["severity"]>("P2")
  return (
    <Section title="New bug" sub="Opens a linked Linear issue">
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; mutate((p) => newBug(p, { title: title.trim(), detail: detail.trim(), clientId: clientId || null, area, severity, source: "QA", assignee: "Hashim" })); done() }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's broken, in one line" aria-label="Title" className="h-10 rounded-[10px]" />
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="How to see it, and what should happen instead" aria-label="Detail" className="min-h-20 rounded-[10px] text-sm" />
        <div className="flex flex-wrap items-end gap-2">
          <select aria-label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={sel}><option value="">Platform</option>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value as Bug["area"])} className={sel}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
          <select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as Bug["severity"])} className={sel}>{(["P0", "P1", "P2", "P3"] as const).map((k) => <option key={k} value={k}>{k} · {SEVERITY[k].label}</option>)}</select>
          <Button type="submit" disabled={!title.trim()} className="h-9 rounded-[10px]"><BugIcon />Open bug</Button>
          <Button type="button" variant="ghost" className="h-9 rounded-[10px]" onClick={done}>Cancel</Button>
        </div>
      </form>
    </Section>
  )
}

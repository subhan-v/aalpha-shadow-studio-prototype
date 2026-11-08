"use client"

// The Ops Playbook in the client app, by department. Owners edit any SOP and managers edit
// their own department's. Every save is a new version with a note, logged, and Aalpha hears
// about it in Studio Requests. Members see the SOPs for their own work in My workflows.

import { useState } from "react"
import { Download, History, Pencil, Plus, Target, Trash2 } from "lucide-react"
import { SopView } from "@/components/sop-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fmt } from "@/lib/dates"
import { goalFocus } from "@/lib/goals"
import { newRequest } from "@/lib/requests"
import { useStore } from "@/lib/store"
import type { Client, Role, Seat, Sop } from "@/lib/types"
import { CAT_FN, funcOf } from "@/lib/teams"
import { cn } from "@/lib/utils"
import { download } from "@/lib/workbook"
import { Empty } from "./home"


export const sopDept = (c: Client, sop: Sop) => CAT_FN[c.workflows.find((w) => w.id === sop.workflowId)?.category ?? "Ops and admin"]
// A manager edits the SOPs of their function (in pods: a function head edits their function across pods).
const myDept = (c: Client, me: Seat) => funcOf(me)

export function PlaybookView({ c, role, me }: { c: Client; role: Role; me: Seat }) {
  const focus = goalFocus(c)
  const cat = (x: Sop) => c.workflows.find((w) => w.id === x.workflowId)?.category
  const all = c.sops.filter((x) => x.status === "published").sort((a, b) => (focus.get(cat(b)!)?.weight ?? 0) - (focus.get(cat(a)!)?.weight ?? 0))
  const depts = Array.from(new Set(all.map((x) => sopDept(c, x))))
  const [dept, setDept] = useState("All")
  const [open, setOpen] = useState<string | null>(all[0]?.id ?? null)
  const [editing, setEditing] = useState(false)
  if (!all.length) return <Empty title="Your Ops Playbook is being written" body="Every workflow your team repeats, step by step with the tools you use. The first SOPs land in your first three weeks." />
  const sops = all.filter((x) => dept === "All" || sopDept(c, x) === dept)
  const sop = sops.find((x) => x.id === open) ?? sops[0] ?? all[0]
  const canEdit = role === "Owner" || (role === "Manager" && myDept(c, me) === sopDept(c, sop))
  const md = () => {
    let n = 0
    return [`# ${sop.title}`, "", ...sop.sections.flatMap((sec) => [`## ${sec.name} (${sec.role})`, "", ...sec.steps.map((st) => `${++n}. ${st.before} "${st.label}" ${st.after} (${st.mins} min)`), ""])].join("\n")
  }
  return (
    <div data-tour="playbook" className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Department">
        {["All", ...depts].map((d) => <button key={d} aria-pressed={dept === d} onClick={() => { setDept(d); setEditing(false) }} className={cn("h-8 rounded-full border px-3 text-sm", dept === d ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "bg-card text-[var(--text-secondary)]")}>{d}<span className="ml-1.5 text-xs opacity-70">{d === "All" ? all.length : all.filter((x) => sopDept(c, x) === d).length}</span></button>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {focus.size > 0 && <span className="flex items-center gap-1.5 px-1 text-xs text-[var(--text-muted)]"><Target className="size-3.5 text-[var(--bronze)]" />Tuned to your goals: SOPs that serve them come first</span>}
          {sops.map((x) => (
            <button key={x.id} onClick={() => { setOpen(x.id); setEditing(false) }} className={cn("flex flex-col gap-1 rounded-2xl border p-3.5 text-left", x.id === sop.id ? "border-[var(--graphite)] bg-card" : "bg-card/60 hover:bg-card")}>
              <span className="text-sm font-medium">{x.title}</span>
              <span className="text-xs text-[var(--text-muted)]">{sopDept(c, x)} · {x.sections.reduce((n, sec) => n + sec.steps.length, 0)} steps · v{x.version}</span>
              {focus.get(cat(x)!) && <span className="text-xs text-[var(--text-muted)]">Serves &quot;{focus.get(cat(x)!)!.goals[0].title}&quot;</span>}
            </button>
          ))}
          <Button variant="outline" className="mt-2 rounded-xl" onClick={() => download(`${sop.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`, md(), "text/markdown")}><Download />Download this SOP (text file)</Button>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {!editing && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
              <History className="size-4 text-[var(--text-muted)]" />
              <span className="flex-1 text-[var(--text-secondary)]">{sop.history?.length ? `v${sop.version}: ${sop.history[0].note} (${sop.history[0].by}, ${fmt(sop.history[0].at)})` : `v${sop.version}, written by Aalpha from how your team works`}</span>
              {canEdit ? <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setEditing(true)}><Pencil />Edit</Button> : <span className="text-xs text-[var(--text-muted)]">{role === "Manager" ? `You can edit ${myDept(c, me) ?? "your department"} SOPs` : ""}</span>}
            </div>
          )}
          {editing ? <Editor key={sop.id} c={c} sop={sop} me={me} done={() => setEditing(false)} /> : <>{c.workflows.find((w) => w.id === sop.workflowId)?.neverAutomate && <div className="rounded-2xl border border-[var(--status-critical)] bg-[var(--bad-bg)] px-4 py-3 text-sm text-[var(--delta-bad)]">Never automate: {c.workflows.find((w) => w.id === sop.workflowId)!.neverAutomate!.note}. From {c.workflows.find((w) => w.id === sop.workflowId)!.neverAutomate!.by}&apos;s interview. No step here is handed to an agent.</div>}<SopView sop={sop} wf={c.workflows.find((w) => w.id === sop.workflowId)} /></>}
        </div>
      </div>
    </div>
  )
}

function Editor({ c, sop, me, done }: { c: Client; sop: Sop; me: Seat; done: () => void }) {
  const { mutate } = useStore()
  const [d, setD] = useState<Sop>(sop)
  const [note, setNote] = useState("")
  const step = (sid: string, patch: Partial<Sop["sections"][number]["steps"][number]>) => setD((x) => ({ ...x, sections: x.sections.map((sec) => ({ ...sec, steps: sec.steps.map((st) => (st.id === sid ? { ...st, ...patch } : st)) })) }))
  const save = () => mutate((p) => {
    const v = sop.version + 1
    const text = note.trim() || "Edited steps"
    const next = newRequest(p, { clientId: c.id, from: `${me.name} (${c.name})`, source: "Client app", kind: "Change", title: `Playbook edited: ${d.title} v${v}`, detail: text, priority: "Normal", assignee: c.owner })
    const saved: Sop = { ...d, version: v, history: [{ v, at: p.today, by: me.name, note: text }, ...(sop.history ?? [])] }
    return { ...next, clients: next.clients.map((x) => (x.id === c.id ? { ...x, sops: x.sops.map((y) => (y.id === sop.id ? saved : y)), log: [{ date: p.today, text: `${me.name} saved ${d.title} v${v}: ${text}` }, ...x.log] } : x)) }
  })
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--seq-500)] bg-card p-5">
      <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">Title<Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} className="h-10 rounded-[10px] text-base font-semibold text-[var(--text-primary)]" /></label>
      {d.sections.map((sec) => (
        <div key={sec.id} className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{sec.name} <span className="font-normal text-[var(--text-muted)]">· {sec.role}</span></span>
          {sec.steps.map((st, i) => (
            <div key={st.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[24px_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_72px_32px] sm:items-center">
              <span className="text-xs font-semibold text-[var(--text-muted)]">{i + 1}</span>
              <Input aria-label="Before the button" value={st.before} onChange={(e) => step(st.id, { before: e.target.value })} className="h-9 rounded-[10px] text-sm" />
              <Input aria-label="Button or field" value={st.label} onChange={(e) => step(st.id, { label: e.target.value })} className="h-9 rounded-[10px] font-mono text-sm" />
              <Input aria-label="After the button" value={st.after} onChange={(e) => step(st.id, { after: e.target.value })} className="h-9 rounded-[10px] text-sm" />
              <Input aria-label="Minutes" type="number" min={1} value={st.mins} onChange={(e) => step(st.id, { mins: Math.max(1, Number(e.target.value)) })} className="h-9 rounded-[10px] text-sm" />
              <Button size="icon-sm" variant="ghost" aria-label="Remove step" onClick={() => setD((x) => ({ ...x, sections: x.sections.map((s2) => ({ ...s2, steps: s2.steps.filter((y) => y.id !== st.id) })) }))}><Trash2 /></Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="w-fit rounded-[10px]" onClick={() => setD((x) => ({ ...x, sections: x.sections.map((s2) => (s2.id === sec.id ? { ...s2, steps: [...s2.steps, { id: `${sec.id}-n${Date.now()}`, tool: s2.steps[0]?.tool ?? "docs", before: "Open", label: "New step", after: "", mins: 2, auto: false }] } : s2)) }))}><Plus />Add a step</Button>
        </div>
      ))}
      <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">What changed<Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="We now QA reports before they go to the account lead." className="h-10 rounded-[10px] text-sm text-[var(--text-primary)]" /></label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-xs text-[var(--text-muted)]">Saves as v{sop.version + 1}. Aalpha sees every change.</span>
        <Button variant="ghost" className="rounded-[10px]" onClick={done}>Cancel</Button>
        <Button className="rounded-[10px]" onClick={() => { save(); done() }}>Save v{sop.version + 1}</Button>
      </div>
    </div>
  )
}

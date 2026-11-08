"use client"

/* eslint-disable @next/next/no-img-element */
import { useState } from "react"
import { ArrowDown, ArrowUp, Bot, Eye, Pencil, Plus, Trash2 } from "lucide-react"
import { Pill, Section } from "@/components/bits"
import { SopView } from "@/components/sop-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { draftSop, TOOL_NAME, toolIcon } from "@/lib/delivery"
import { visibleWorkflows } from "@/lib/engine"
import { fmt } from "@/lib/dates"
import { useStore } from "@/lib/store"
import type { Client, Sop, SopStep, Tool } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

const TOOLS = Object.keys(TOOL_NAME) as Tool[]

/** Playbook studio: turn a workflow into an SOP, edit it, publish it. */
export function PlaybookTab({ c }: { c: Client }) {
  const { s, update } = useStore()
  const [openId, setOpenId] = useState<string | null>(c.sops[0]?.id ?? null)
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const sop = c.sops.find((x) => x.id === openId) ?? null
  const candidates = visibleWorkflows(c, s.today).filter((w) => !c.sops.some((x) => x.workflowId === w.id))
  const setSop = (patch: Partial<Sop> | ((x: Sop) => Sop)) =>
    update(c.id, (x) => ({ ...x, sops: x.sops.map((y) => (y.id === openId ? (typeof patch === "function" ? patch(y) : { ...y, ...patch }) : y)) }))
  const setStep = (sid: string, patch: Partial<SopStep>) =>
    setSop((x) => ({ ...x, sections: x.sections.map((sec) => ({ ...sec, steps: sec.steps.map((st) => (st.id === sid ? { ...st, ...patch } : st)) })) }))

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Section title="Ops Playbook" sub={`${c.sops.filter((x) => x.status === "published").length} of ${c.sops.length} published · founder bonus`}>
        <div className="flex flex-col gap-1.5">
          {c.sops.map((x) => (
            <button key={x.id} onClick={() => setOpenId(x.id)} className={cn("flex flex-col gap-1 rounded-xl border p-3 text-left transition", x.id === openId ? "border-[var(--graphite)] bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]")}>
              <span className="text-sm font-medium">{x.title}</span>
              <span className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Pill t={x.status === "published" ? "good" : "muted"}>{x.status === "published" ? `Published v${x.version}` : "Draft"}</Pill>{x.checked ? `checked ${fmt(x.checked)}` : ""}</span>
            </button>
          ))}
          {c.sops.length === 0 && <p className="py-2 text-sm text-[var(--text-muted)]">No SOPs yet.</p>}
        </div>
        <div className="mt-4 flex flex-col gap-1.5 border-t pt-4">
          <span className="text-xs text-[var(--text-muted)]">Draft an SOP from a published workflow</span>
          {candidates.length ? (
            <Select value="" onValueChange={(v) => {
              const w = c.workflows.find((y) => y.id === v)
              if (!w) return
              const d = draftSop(c, w, s.today)
              update(c.id, (x, t) => ({ ...x, sops: [...x.sops, d], log: [{ date: t, text: `SOP drafted from "${w.name}".` }, ...x.log] }))
              setOpenId(d.id)
            }}>
              <SelectTrigger className="h-9 w-full rounded-[10px] bg-card" aria-label="Draft from workflow"><Plus className="size-4" /><span className="text-sm">Pick a workflow</span></SelectTrigger>
              <SelectContent>{candidates.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : <span className="text-xs text-[var(--text-muted)]">Publish workflows in the review queue first.</span>}
        </div>
      </Section>

      {sop ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl border bg-card p-1">
              {(["edit", "preview"] as const).map((m) => (
                <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-sm", mode === m ? "bg-[var(--graphite)] text-white" : "text-[var(--text-secondary)]")}>{m === "edit" ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}{m === "edit" ? "Edit" : "Client view"}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setSop({ checked: s.today })}>Mark checked today</Button>
              {sop.status === "draft"
                ? <Button size="sm" className="rounded-[10px]" onClick={() => { setSop({ status: "published", version: sop.version + 1, checked: s.today }); update(c.id, (x, t) => ({ ...x, log: [{ date: t, text: `SOP published: ${sop.title}.` }, ...x.log] })) }}>Publish to client</Button>
                : <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setSop({ status: "draft" })}>Unpublish</Button>}
              <Button size="icon-sm" variant="ghost" aria-label="Delete SOP" onClick={() => { update(c.id, (x) => ({ ...x, sops: x.sops.filter((y) => y.id !== sop.id) })); setOpenId(null) }}><Trash2 /></Button>
            </div>
          </div>

          {mode === "preview" ? <SopView sop={sop} wf={c.workflows.find((w) => w.id === sop.workflowId)} /> : (
            <Section title="Edit SOP" sub={`Steps come from what ${APP} saw. Tidy the wording, keep one action per step.`}>
              <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Title<Input value={sop.title} onChange={(e) => setSop({ title: e.target.value })} className="h-9 rounded-[10px] text-sm" /></label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Owner on the client&apos;s team<Input value={sop.owner} onChange={(e) => setSop({ owner: e.target.value })} className="h-9 rounded-[10px] text-sm" /></label>
              </div>
              {sop.sections.map((sec, si) => (
                <div key={sec.id} className="mb-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input value={sec.name} aria-label="Section name" onChange={(e) => setSop((x) => ({ ...x, sections: x.sections.map((y) => (y.id === sec.id ? { ...y, name: e.target.value } : y)) }))} className="h-8 max-w-60 rounded-[10px] text-sm font-medium" />
                    <Input value={sec.role} aria-label="Role" onChange={(e) => setSop((x) => ({ ...x, sections: x.sections.map((y) => (y.id === sec.id ? { ...y, role: e.target.value } : y)) }))} className="h-8 max-w-48 rounded-[10px] text-xs" />
                  </div>
                  {sec.steps.map((st, i) => (
                    <div key={st.id} className="grid items-center gap-2 rounded-xl border p-2.5 lg:grid-cols-[150px_minmax(0,1fr)_120px_minmax(0,1fr)_70px_auto]">
                      <Select value={st.tool} onValueChange={(v) => v && setStep(st.id, { tool: v as Tool })}>
                        <SelectTrigger size="sm" className="h-8 w-full rounded-[10px]" aria-label="Tool"><img src={toolIcon(st.tool)} alt="" className="size-4" /><span className="flex-1 truncate text-left">{TOOL_NAME[st.tool]}</span></SelectTrigger>
                        <SelectContent>{TOOLS.map((t) => <SelectItem key={t} value={t}>{TOOL_NAME[t]}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input value={st.before} aria-label="Instruction" onChange={(e) => setStep(st.id, { before: e.target.value })} className="h-8 rounded-[10px] text-sm" />
                      <Input value={st.label} aria-label="Button label" onChange={(e) => setStep(st.id, { label: e.target.value })} className="h-8 rounded-[10px] font-mono text-xs" />
                      <Input value={st.after} aria-label="Then" onChange={(e) => setStep(st.id, { after: e.target.value })} className="h-8 rounded-[10px] text-sm" />
                      <Input type="number" value={st.mins} aria-label="Minutes" onChange={(e) => setStep(st.id, { mins: Number(e.target.value) })} className="h-8 rounded-[10px] text-sm" />
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-1 text-xs text-[var(--text-muted)]" title="Can be automated"><Bot className="size-3.5" /><Switch checked={st.auto} onCheckedChange={(v) => setStep(st.id, { auto: !!v })} /></label>
                        <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => setSop((x) => ({ ...x, sections: x.sections.map((y) => (y.id !== sec.id ? y : { ...y, steps: swap(y.steps, i, i - 1) })) }))}><ArrowUp /></Button>
                        <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === sec.steps.length - 1} onClick={() => setSop((x) => ({ ...x, sections: x.sections.map((y) => (y.id !== sec.id ? y : { ...y, steps: swap(y.steps, i, i + 1) })) }))}><ArrowDown /></Button>
                        <Button size="icon-xs" variant="ghost" aria-label="Delete step" onClick={() => setSop((x) => ({ ...x, sections: x.sections.map((y) => (y.id !== sec.id ? y : { ...y, steps: y.steps.filter((z) => z.id !== st.id) })) }))}><Trash2 /></Button>
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="w-fit" onClick={() => setSop((x) => ({ ...x, sections: x.sections.map((y, yi) => (yi !== si ? y : { ...y, steps: [...y.steps, { id: `${y.id}-n${Date.now()}`, tool: y.steps.at(-1)?.tool ?? "slack", before: "Click", label: "Button", after: "", mins: 2, auto: false }] })) }))}><Plus />Add step</Button>
                </div>
              ))}
            </Section>
          )}
        </div>
      ) : (
        <Section title="No SOP open" sub="Pick one on the left, or draft one from a workflow."><span /></Section>
      )}
    </div>
  )
}

function swap<T>(a: T[], i: number, j: number): T[] {
  const b = [...a]
  ;[b[i], b[j]] = [b[j], b[i]]
  return b
}

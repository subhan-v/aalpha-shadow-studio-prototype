"use client"

import { useState } from "react"
import { Eye, EyeOff, GitMerge } from "lucide-react"
import { CatBubble, Pill, Section } from "@/components/bits"
import { ToolChip } from "@/components/sop-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { reviewQueue, visibleWorkflows } from "@/lib/engine"
import { useStore } from "@/lib/store"
import type { Category, Client, Tier, Workflow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

const CATS: Category[] = ["Reporting", "Paid media", "Ops and admin", "Client delivery", "Creative", "Sales"]
const TIER: Record<Tier, string> = { H: "High", M: "Medium", L: "Low" }

/** The quality gate: nothing Shadow finds reaches the client until someone here publishes it. */
export function ReviewTab({ c }: { c: Client }) {
  const { s, update } = useStore()
  const queue = reviewQueue(c, s.today)
  const live = visibleWorkflows(c, s.today)
  const hidden = c.workflows.filter((w) => w.review === "hidden" || w.mergedInto)
  const set = (id: string, patch: Partial<Workflow>, text?: string) =>
    update(c.id, (x, t) => ({ ...x, workflows: x.workflows.map((w) => (w.id === id ? { ...w, ...patch } : w)), log: text ? [{ date: t, text }, ...x.log] : x.log }))

  return (
    <div className="flex flex-col gap-4">
      <Section title="Review queue" sub={`New workflows ${APP} found. Rename in plain words, set the category and return, then publish. Hide anything private.`}
        right={queue.length > 1 ? <Button size="sm" className="rounded-[10px]" onClick={() => update(c.id, (x, t) => ({ ...x, workflows: x.workflows.map((w) => (queue.some((q) => q.id === w.id) ? { ...w, review: "published" } : w)), log: [{ date: t, text: `Published ${queue.length} workflows to the client.` }, ...x.log] }))}>Publish all {queue.length}</Button> : null}>
        {queue.length === 0 && <p className="py-4 text-sm text-[var(--text-muted)]">Queue is empty. New workflows appear here as {APP} finds them.</p>}
        <div className="flex flex-col gap-3">
          {queue.map((w) => <ReviewCard key={w.id} w={w} all={c.workflows} set={set} />)}
        </div>
      </Section>
      <Section title="Published to the client" sub={`${live.length} workflows · ${live.reduce((n, w) => n + w.hoursWk, 0).toFixed(1)} h/wk`}>
        <div className="flex flex-col">
          {live.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
              <span className="min-w-48 flex-1 font-medium">{w.name}</span>
              <CatBubble c={w.category} />
              <Pill t={w.tier === "H" ? "info" : "muted"}>{TIER[w.tier]}</Pill>
              <span className="w-20 text-right tabular-nums">{w.hoursWk} h/wk</span>
              <Button size="sm" variant="ghost" onClick={() => set(w.id, { review: "new" }, `Unpublished ${w.name}.`)}><EyeOff />Unpublish</Button>
            </div>
          ))}
          {live.length === 0 && <p className="py-2 text-sm text-[var(--text-muted)]">Nothing published yet. The client sees an empty state that says findings are being reviewed.</p>}
        </div>
      </Section>
      {hidden.length > 0 && (
        <Section title="Hidden or merged" sub="Never shown to the client">
          {hidden.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-3 border-t py-2 text-sm first:border-t-0">
              <span className="flex-1 text-[var(--text-secondary)]">{w.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{w.mergedInto ? `Merged into ${c.workflows.find((x) => x.id === w.mergedInto)?.name}` : "Hidden"}</span>
              <Button size="sm" variant="ghost" onClick={() => set(w.id, { review: "new", mergedInto: null }, `Restored ${w.name} to the queue.`)}>Restore</Button>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function ReviewCard({ w, all, set }: { w: Workflow; all: Workflow[]; set: (id: string, p: Partial<Workflow>, text?: string) => void }) {
  const [name, setName] = useState(w.name)
  const targets = all.filter((x) => x.id !== w.id && x.category === w.category && !x.mergedInto)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-muted)]">{APP} named it</span>
        <span className="text-sm text-[var(--text-secondary)]">{w.rawName}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Client sees
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== w.name && set(w.id, { name }, `Renamed to "${name}".`)} className="h-9 rounded-[10px] text-sm text-[var(--text-primary)]" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Category
          <Select value={w.category} onValueChange={(v) => v && set(w.id, { category: v as Category })}>
            <SelectTrigger className="h-9 w-full rounded-[10px] bg-card" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>{CATS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <div className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Return
          <div role="group" aria-label="Return" className="flex h-9 rounded-[10px] border p-0.5">
            {(["H", "M", "L"] as Tier[]).map((t) => (
              <button key={t} aria-pressed={w.tier === t} onClick={() => set(w.id, { tier: t })} className={cn("rounded-[8px] px-3 text-xs", w.tier === t ? "bg-[var(--graphite)] text-white" : "text-[var(--text-secondary)]")}>{TIER[t]}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
        <span><b className="text-[var(--text-primary)]">{w.hoursWk} h/wk</b> back</span>
        <span>{w.people} people</span><span>{w.runs} runs</span><span>{w.ways} ways it&apos;s done</span>
        <span className="flex flex-wrap gap-1">{w.tools.map((t) => <ToolChip key={t} t={t} compact />)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        {targets.length > 0 && (
          <Select value="" onValueChange={(v) => v && set(w.id, { mergedInto: String(v) }, `Merged "${w.name}" into "${targets.find((x) => x.id === v)?.name}".`)}>
            <SelectTrigger size="sm" className="h-8 rounded-[10px]" aria-label="Merge into"><GitMerge className="size-3.5" /><span className="text-xs">Merge into…</span></SelectTrigger>
            <SelectContent>{targets.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Button size="sm" variant="ghost" onClick={() => set(w.id, { review: "hidden" }, `Hid "${w.name}" (private or not useful).`)}><EyeOff />Hide</Button>
        <Button size="sm" className="rounded-[10px]" onClick={() => set(w.id, { review: "published", name }, `Published "${name}" to the client.`)}><Eye />Publish</Button>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Check, Clock, Lightbulb } from "lucide-react"
import { PageHeader, Section } from "@/components/bits"
import { Input } from "@/components/ui/input"
import { LIBRARY } from "@/lib/library"
import { cn } from "@/lib/utils"

export default function Library() {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(LIBRARY[0].id)
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const list = LIBRARY.filter((d) => !q || (d.title + d.tags.join(" ")).toLowerCase().includes(q.toLowerCase()))
  const doc = LIBRARY.find((d) => d.id === open) ?? list[0]
  return (
    <>
      <PageHeader title="Library" sub="How we do client work, step by step. Onboarding, setup, Viktor, building, QA and the weekly rhythm." />
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" className="h-10 rounded-xl" aria-label="Search the library" />
          <nav className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-card">
            {list.map((d) => (
              <button key={d.id} onClick={() => setOpen(d.id)} aria-current={doc?.id === d.id ? "page" : undefined} className={cn("flex flex-col gap-0.5 border-t px-4 py-3 text-left first:border-t-0 hover:bg-[var(--surface-2)]", doc?.id === d.id && "bg-[var(--seq-100)]")}>
                <span className="text-sm font-medium">{d.title}</span>
                <span className="text-xs text-[var(--text-muted)]">{d.when}</span>
              </button>
            ))}
          </nav>
        </div>
        {doc && (
          <Section title={doc.title} sub={`${doc.when} · ${doc.owner}`} right={<span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Clock className="size-3.5" />{doc.mins} min</span>}>
            <ol className="flex flex-col">
              {doc.steps.map((st, i) => {
                const k = `${doc.id}-${i}`
                return (
                  <li key={k} className="flex gap-3 border-t py-3 first:border-t-0">
                    <button aria-pressed={!!ticked[k]} aria-label={`Step ${i + 1} done`} onClick={() => setTicked({ ...ticked, [k]: !ticked[k] })} className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums", ticked[k] ? "border-[var(--status-good)] bg-[var(--status-good)] text-white" : "text-[var(--text-secondary)]")}>{ticked[k] ? <Check className="size-3.5" /> : i + 1}</button>
                    <span className="flex flex-col gap-1 text-sm"><span className={cn(ticked[k] && "text-[var(--text-muted)] line-through")}>{st.text}</span>{st.tip && <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Lightbulb className="size-3.5 text-[var(--watch-fg)]" />{st.tip}</span>}</span>
                  </li>
                )
              })}
            </ol>
          </Section>
        )}
      </div>
    </>
  )
}

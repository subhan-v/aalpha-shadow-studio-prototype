"use client"

// Scribe-style SOP: tool chips in the header, one plain instruction per step with
// the exact button label, the tool's icon on every step, time per step, an
// automation flag, and evidence from Shadow. Same view in Studio and the client app.

/* eslint-disable @next/next/no-img-element */
import { Bot } from "lucide-react"
import { TOOL_NAME, toolIcon } from "@/lib/delivery"
import { fmt } from "@/lib/dates"
import type { Sop, Tool, Workflow } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ToolChip({ t, compact }: { t: Tool; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card text-xs font-medium", compact ? "h-6 px-2" : "h-8 pl-1.5 pr-3")}>
      <img src={toolIcon(t)} alt="" className={compact ? "size-3.5" : "size-5"} />
      {TOOL_NAME[t]}
    </span>
  )
}

export function SopView({ sop, wf }: { sop: Sop; wf?: Workflow }) {
  const steps = sop.sections.flatMap((s) => s.steps)
  const tools = Array.from(new Set(steps.map((s) => s.tool)))
  const total = steps.reduce((n, s) => n + s.mins, 0)
  const auto = steps.filter((s) => s.auto).reduce((n, s) => n + s.mins, 0)
  // Step numbers run across sections.
  const number = new Map(steps.map((st, i) => [st.id, i + 1]))
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border bg-card p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl">{sop.title}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{steps.length} steps · about {total} min · Owner {sop.owner} · v{sop.version}{sop.checked ? ` · checked ${fmt(sop.checked)}` : " · not checked yet"}</p>
        </div>
        <div className="flex flex-wrap gap-2">{tools.map((t) => <ToolChip key={t} t={t} />)}</div>
        {wf && (
          <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <Ev v={`${wf.runs} times`} k="seen in 2 weeks" />
            <Ev v={`${wf.people} people`} k="do this job" />
            <Ev v={wf.ways > 1 ? `Fastest of ${wf.ways}` : "One way"} k="ways it's done" />
            <Ev v={`${auto} min`} k={`of ${total} can be automated`} />
          </div>
        )}
      </div>

      {sop.sections.map((sec) => (
        <div key={sec.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-3 pt-1">
            <h3 className="text-lg">{sec.name}</h3>
            <span className="rounded-full bg-[var(--seq-100)] px-2.5 py-0.5 text-xs font-medium text-[var(--seq-900)]">{sec.role}</span>
            <span className="h-px flex-1 bg-[var(--grid)]" />
            <span className="text-xs text-[var(--text-muted)]">{sec.steps.reduce((n, s) => n + s.mins, 0)} min</span>
          </div>
          {sec.steps.map((st) => {
            const k = number.get(st.id)!
            return (
              <article key={st.id} className="grid gap-5 rounded-[var(--radius-card)] border bg-card p-5 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
                <div className="flex min-w-0 flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-full bg-[var(--graphite)] text-xs font-semibold text-white">{k}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"><img src={toolIcon(st.tool)} alt="" className="size-4" />{TOOL_NAME[st.tool]}</span>
                    <span className="ml-auto font-mono text-xs text-[var(--text-muted)]">{st.mins} min</span>
                  </div>
                  <p className="text-[15px] leading-relaxed">
                    {st.before} <span className="rounded-md border bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[13px]">{st.label}</span> {st.after}
                  </p>
                  {st.auto && <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--good-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--delta-good)]"><Bot className="size-3.5" />Can be automated</span>}
                  {st.tip && <p className="rounded-lg bg-[var(--watch-bg)] px-3 py-2 text-xs text-[var(--watch-fg)]">Tip: {st.tip}</p>}
                </div>
                <div role="img" aria-label="Screenshot cropped to the action" className="relative h-36 overflow-hidden rounded-xl border bg-[var(--surface-2)]">
                  <div className="flex h-7 items-center gap-2 border-b bg-card px-3"><img src={toolIcon(st.tool)} alt="" className="size-3.5" /><span className="h-1.5 w-24 rounded-full bg-[var(--grid)]" /></div>
                  <div className="flex flex-col gap-2 p-3"><span className="h-1.5 w-3/4 rounded-full bg-[var(--grid)]" /><span className="h-1.5 w-1/2 rounded-full bg-[var(--grid)]" /><span className="h-1.5 w-2/3 rounded-full bg-[var(--grid)]" /></div>
                  <span className="absolute rounded-md bg-card px-2.5 py-1 text-xs font-semibold shadow-[0_0_0_3px_var(--bronze),0_0_0_7px_color-mix(in_oklch,var(--bronze),transparent_80%)]" style={{ left: `${12 + ((k * 23) % 50)}%`, top: `${48 + ((k * 17) % 50)}px` }}>{st.label}</span>
                  <span className="absolute bottom-2 left-3 text-xs text-[var(--text-muted)]">Client names blurred</span>
                </div>
              </article>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Ev({ v, k }: { v: string; k: string }) {
  return <div className="flex flex-col"><span className="text-lg font-semibold tracking-[-0.01em]">{v}</span><span className="text-xs text-[var(--text-muted)]">{k}</span></div>
}

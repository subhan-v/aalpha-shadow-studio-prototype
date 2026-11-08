"use client"

// Weekly cost (stacked by type) and margin, as two charts on the same weeks: never one chart
// with two axes. Changes we made to cut costs are marked on both, so you can see if they
// worked; a week over 2x the four before is flagged. Hover any week; or switch to the table.

import { useState } from "react"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Table2 } from "lucide-react"
import { fmt } from "@/lib/dates"
import { COST_CHANGES, costVerdict, type CostWeek } from "@/lib/finance"
import { cn } from "@/lib/utils"

const PARTS: { key: "ai" | "storage" | "agents"; label: string; color: string }[] = [
  { key: "ai", label: "Screen analysis (AI)", color: "#2a78d6" },
  { key: "storage", label: "Storage", color: "#eb6834" },
  { key: "agents", label: "Agent runs", color: "#1baf7a" },
]
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

type Week = CostWeek

export function CostCharts({ weeks, title = "Weekly cost and margin" }: { weeks: Week[]; title?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const v = costVerdict(weeks)
  const max = Math.max(1, ...weeks.map((w) => w.total)) * 1.08
  const margins = weeks.map((w) => w.margin ?? 0)
  const mMin = Math.min(0, ...margins), mMax = Math.max(100, ...margins)
  const y = (m: number) => 100 - ((m - mMin) / (mMax - mMin)) * 100
  const changeAt = (i: number) => COST_CHANGES.filter((c) => c.date > (weeks[i - 1]?.end ?? "0") && c.date <= weeks[i].end)
  const h = hover !== null ? weeks[hover] : null
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col"><span className="text-lg">{title}</span><span className={cn("flex items-center gap-1 text-sm font-medium", v.good ? "text-[var(--delta-good)]" : "text-[var(--delta-bad)]")}>{v.pct < 0 ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}{v.word}</span>{v.note && <span className="text-xs text-[var(--text-muted)]">{v.note}</span>}</span>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">{PARTS.map((p) => <span key={p.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.label}</span>)}</div>
          <button aria-pressed={table} onClick={() => setTable(!table)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-xs"><Table2 className="size-3.5" />{table ? "Chart" : "Table"}</button>
        </div>
      </div>

      {table ? (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-xs text-[var(--text-muted)]"><th className="px-3 py-2 text-left font-normal">Week ending</th>{PARTS.map((p) => <th key={p.key} className="px-3 py-2 text-right font-normal">{p.label}</th>)}<th className="px-3 py-2 text-right font-normal">Total</th><th className="px-3 py-2 text-right font-normal">Revenue</th><th className="px-3 py-2 text-right font-normal">Margin</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.end} className="border-t"><td className="px-3 py-2">{fmt(w.end)}{w.spike && <span className="ml-2 text-xs text-[var(--delta-bad)]">spike</span>}</td>{PARTS.map((p) => <td key={p.key} className="px-3 py-2 text-right tabular-nums">{usd(w[p.key])}</td>)}<td className="px-3 py-2 text-right font-semibold tabular-nums">{usd(w.total)}</td><td className="px-3 py-2 text-right tabular-nums">{usd(w.revenue)}</td><td className="px-3 py-2 text-right tabular-nums">{w.margin === null ? "–" : `${w.margin}%`}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="flex h-48 items-end gap-1.5 border-b" role="img" aria-label={`Weekly cost for ${weeks.length} weeks, from ${usd(weeks[0].total)} to ${usd(weeks[weeks.length - 1].total)}`}>
              {weeks.map((w, i) => (
                <div key={w.end} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="relative flex h-full flex-1 flex-col justify-end">
                  {changeAt(i).length > 0 && <span aria-hidden className="absolute inset-y-0 -left-1 border-l border-dashed border-[var(--text-muted)]" />}
                  {w.spike && <AlertTriangle className="mx-auto mb-1 size-3.5 text-[var(--status-critical)]" aria-label="Spike" />}
                  <div className={cn("mx-auto flex w-full max-w-8 flex-col-reverse gap-[2px]", hover === i && "opacity-90")} style={{ height: `${(w.total / max) * 100}%` }}>
                    {PARTS.map((p, k) => w[p.key] > 0 && <div key={p.key} className={k === PARTS.length - 1 || PARTS.slice(k + 1).every((q) => !w[q.key]) ? "rounded-t-[4px]" : ""} style={{ flex: `${w[p.key]} 1 0`, background: p.color, minHeight: 2 }} />)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">{weeks.map((w, i) => <span key={w.end} className="flex-1 text-center text-xs text-[var(--text-muted)]">{i % 2 === 1 || weeks.length < 8 ? fmt(w.end) : ""}</span>)}</div>
            {h && (
              <div className="pointer-events-none absolute top-0 z-10 w-56 rounded-xl border bg-card p-3 text-xs shadow-lg" style={{ left: `min(calc(${((hover! + 0.5) / weeks.length) * 100}% + 8px), calc(100% - 14rem))` }}>
                <div className="mb-1 font-semibold">Week ending {fmt(h.end)}</div>
                {PARTS.map((p) => <div key={p.key} className="flex justify-between gap-2"><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: p.color }} />{p.label}</span><span className="tabular-nums">{usd(h[p.key])}</span></div>)}
                <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{usd(h.total)}</span></div>
                <div className="flex justify-between text-[var(--text-secondary)]"><span>Revenue</span><span className="tabular-nums">{usd(h.revenue)}</span></div>
                {h.spike && <div className="mt-1 text-[var(--delta-bad)]">{h.spike}</div>}
                {changeAt(hover!).map((c) => <div key={c.date} className="mt-1 text-[var(--text-secondary)]">{fmt(c.date)}: {c.text}</div>)}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Margin</span>
            <div className="relative h-24 border-b" role="img" aria-label={`Margin from ${margins[0]}% to ${margins[margins.length - 1]}%`}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                <polyline points={margins.map((m, i) => `${((i + 0.5) / weeks.length) * 100},${y(m)}`).join(" ")} fill="none" stroke="#6250d6" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
              {margins.map((m, i) => (
                <span key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="absolute -translate-x-1/2 -translate-y-1/2 p-2" style={{ left: `${((i + 0.5) / weeks.length) * 100}%`, top: `${y(m)}%` }}>
                  <span className={cn("block size-2 rounded-full border-2 border-card bg-[#6250d6]", hover === i && "size-3")} />
                </span>
              ))}
              <span className="absolute left-0 -top-1 text-xs tabular-nums text-[var(--text-muted)]">{margins[0]}%</span>
              <span className="absolute right-0 -top-1 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">{margins[margins.length - 1]}% now</span>
            </div>
          </div>
          {COST_CHANGES.some((c) => c.date >= weeks[0].end) && <p className="text-xs text-[var(--text-muted)]">Dashed lines mark cost changes: {COST_CHANGES.filter((c) => c.date >= weeks[0].end).map((c) => `${fmt(c.date)} ${c.text.toLowerCase()}`).join("; ")}.</p>}
        </>
      )}
    </div>
  )
}

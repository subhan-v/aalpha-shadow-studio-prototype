"use client"

// Hours found and hours back at the end of each week, against the 40-hour line.
// Two series, so a legend is always shown; each mark has a hover title.

import { TARGET } from "@/lib/engine"
import { fmt } from "@/lib/dates"

type Pt = { week: number; date: string; found: number; back: number }

export function ProgressChart({ data }: { data: Pt[] }) {
  const W = 640, H = 220, L = 34, B = 26, T = 10, R = 8
  const max = Math.max(60, ...data.map((d) => Math.max(d.found, d.back)))
  const x = (w: number) => L + ((w - 1) / 12) * (W - L - R)
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  const line = (k: "found" | "back") => data.map((d, i) => `${i ? "L" : "M"}${x(d.week)},${y(d[k])}`).join(" ")
  const ticks = [0, 20, 40, 60].filter((v) => v <= max)

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[var(--series-5)]" />Hours found a week</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[var(--series-3)]" />Hours back a week</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-[var(--text-primary)]" />40-hour guarantee</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Hours found and hours back by week">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{v}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(TARGET)} y2={y(TARGET)} stroke="var(--text-primary)" strokeDasharray="4 4" />
        {Array.from({ length: 13 }, (_, i) => (
          <text key={i} x={x(i + 1)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">W{i + 1}</text>
        ))}
        {data.length > 0 && (
          <>
            <path d={line("found")} fill="none" stroke="var(--series-5)" strokeWidth="2" strokeLinejoin="round" />
            <path d={line("back")} fill="none" stroke="var(--series-3)" strokeWidth="2" strokeLinejoin="round" />
            {data.map((d) => (
              <g key={d.week}>
                <circle cx={x(d.week)} cy={y(d.found)} r="4.5" fill="var(--series-5)" stroke="var(--surface-1)" strokeWidth="2"><title>{`Week ${d.week} (${fmt(d.date)}): ${d.found} h found`}</title></circle>
                <circle cx={x(d.week)} cy={y(d.back)} r="4.5" fill="var(--series-3)" stroke="var(--surface-1)" strokeWidth="2"><title>{`Week ${d.week} (${fmt(d.date)}): ${d.back} h back`}</title></circle>
              </g>
            ))}
          </>
        )}
        {data.length === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--text-muted)">First point after week 1</text>}
      </svg>
    </div>
  )
}

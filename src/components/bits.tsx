"use client"

// Shared pieces in Shadow's system: flat 1px surfaces, 20px cards, 12px
// controls, bronze accent, mint and coral only for state. Status is always an
// icon plus a word, never colour alone.

import { AlertTriangle, CheckCircle2, CircleDashed, Clock, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GStatus } from "@/lib/engine"
import type { Req, Severity } from "@/lib/types"

export const tone = {
  good: "bg-[var(--good-bg)] text-[var(--delta-good)]",
  warn: "bg-[var(--watch-bg)] text-[var(--watch-fg)]",
  bad: "bg-[var(--bad-bg)] text-[var(--delta-bad)]",
  info: "bg-[var(--seq-100)] text-[var(--seq-900)]",
  muted: "bg-[var(--surface-2)] text-[var(--text-secondary)]",
}

export function Pill({ t, children, className }: { t: keyof typeof tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", tone[t], className)}>{children}</span>
}

export function SevPill({ s }: { s: Severity | "Critical" | "Warning" }) {
  const t = s === "Critical" ? "bad" : s === "High" || s === "Warning" ? "warn" : s === "Medium" ? "info" : "muted"
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", t === "bad" ? "text-[var(--delta-bad)]" : t === "warn" ? "text-[var(--watch-fg)]" : t === "info" ? "text-[var(--seq-800)]" : "text-[var(--text-muted)]")}>
      <span aria-hidden className={cn("size-2 rounded-full", t === "bad" ? "bg-[var(--status-critical)]" : t === "warn" ? "bg-[var(--status-warning)]" : t === "info" ? "bg-[var(--seq-500)]" : "bg-[var(--text-muted)]/50")} />
      {s}
    </span>
  )
}

export function GPill({ g }: { g: GStatus }) {
  const map: Record<GStatus, [keyof typeof tone, string, React.ReactNode]> = {
    met: ["good", "Met", <CheckCircle2 key="i" className="size-3.5" />],
    on_track: ["good", "On track", <CheckCircle2 key="i" className="size-3.5" />],
    at_risk: ["bad", "At risk", <AlertTriangle key="i" className="size-3.5" />],
    missed: ["bad", "Missed", <XCircle key="i" className="size-3.5" />],
    not_started: ["muted", "Not started", <CircleDashed key="i" className="size-3.5" />],
  }
  const [t, label, icon] = map[g]
  return <Pill t={t}>{icon}{label}</Pill>
}

export function ReqIcon({ s }: { s: Req["status"] }) {
  if (s === "met") return <CheckCircle2 className="size-4 text-[var(--status-good)]" aria-label="Met" />
  if (s === "missed") return <XCircle className="size-4 text-[var(--status-critical)]" aria-label="Missed" />
  if (s === "late" || s === "at_risk") return <AlertTriangle className="size-4 text-[var(--status-warning)]" aria-label="At risk" />
  if (s === "due") return <Clock className="size-4 text-[var(--seq-700)]" aria-label="Due" />
  return <CircleDashed className="size-4 text-[var(--text-muted)]" aria-label="Pending" />
}

export const reqWord: Record<Req["status"], string> = { met: "Met", due: "Due", pending: "Pending", missed: "Missed", at_risk: "At risk", late: "Late" }

export function Kpi({ label, value, note, t, icon, hue }: { label: string; value: React.ReactNode; note?: React.ReactNode; t?: "bad" | "warn"; icon?: React.ReactNode; hue?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] border bg-card p-5">
      <span className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
        {icon && <span aria-hidden className="grid size-7 place-items-center rounded-full [&_svg]:size-3.5" style={{ background: `color-mix(in oklch, ${hue ?? "#2a78d6"}, white 85%)`, color: hue ?? "#2a78d6" }}>{icon}</span>}
        {label}
      </span>
      <span className={cn("text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums", t === "bad" && "text-[var(--delta-bad)]", t === "warn" && "text-[var(--watch-fg)]")}>{value}</span>
      {note && <span className="truncate text-xs text-[var(--text-muted)]">{note}</span>}
    </div>
  )
}

/** Horizontal meter: value against a max, with an optional target tick. */
export function Meter({ value, max, target, t = "info" }: { value: number; max: number; target?: number; t?: "info" | "good" | "bad" | "warn" }) {
  const fill = t === "good" ? "var(--status-good)" : t === "bad" ? "var(--status-critical)" : t === "warn" ? "var(--status-warning)" : "var(--bronze)"
  return (
    <div className="relative h-1.5 w-full rounded-full bg-[var(--surface-2)]">
      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: fill }} />
      {target !== undefined && <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-[var(--text-primary)]" style={{ left: `${Math.min(100, (target / max) * 100)}%` }} aria-hidden />}
    </div>
  )
}

export function Section({ title, sub, right, children, className }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-[var(--radius-card)] border bg-card", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-lg">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="px-6 pb-5">{children}</div>
    </section>
  )
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-[var(--text-secondary)]">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/** Segmented control used for owner and client filters. */
export function Segmented({ options, value, onChange, label }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap rounded-xl border bg-card p-1">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={cn("h-8 rounded-[9px] px-3 text-sm transition-colors", value === o.id ? "bg-[var(--graphite)] font-medium text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Work categories carry a colour each, always with their name (never colour alone).
export const CAT_COLOR: Record<string, string> = {
  Reporting: "#2a78d6", "Paid media": "#eb6834", "Ops and admin": "#1baf7a",
  "Client delivery": "#eda100", Creative: "#e87ba4", Sales: "#6250d6",
}

export function CatBubble({ c, className }: { c: string; className?: string }) {
  const col = CAT_COLOR[c] ?? "#687182"
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", className)}
      style={{ background: `color-mix(in oklch, ${col}, white 86%)`, color: `color-mix(in oklch, ${col}, black 38%)` }}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: col }} />{c}
    </span>
  )
}

/** Says so when a list is cut short, so nothing disappears silently. */
export function Shown({ n, of, hint }: { n: number; of: number; hint?: string }) {
  if (of <= n) return null
  return <p className="pt-2 text-xs text-[var(--text-secondary)]">Showing {n} of {of}.{hint ? ` ${hint}` : ""}</p>
}

"use client"

// Team Fit Map: the org chart, built once from the Culture Intelligence survey, with each
// person's fit to their role as the headline. New members sync in from Culture Intelligence.
// Click a person for their full profile. Reference only, not the final design.

import { useState } from "react"
import { AlertTriangle, ChevronRight } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { hash } from "@/lib/dates"
import type { Client, FitPerson, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"

export const band = (fit: number | null) =>
  fit === null ? { word: "No survey", cls: "bg-[var(--surface-2)] text-[var(--text-muted)]" }
    : fit >= 80 ? { word: "Strong fit", cls: "bg-[var(--good-bg)] text-[var(--delta-good)]" }
    : fit >= 65 ? { word: "Good fit", cls: "bg-[var(--seq-100)] text-[var(--seq-900)]" }
    : { word: "Watch", cls: "bg-[var(--watch-bg)] text-[var(--watch-fg)]" }

const PROFILE: Record<string, { line: string; strengths: string[]; best: string; watch: string }> = {
  Driver: { line: "Moves fast, decides quickly and wants ownership.", strengths: ["Pushes work to done", "Decides with partial information", "Owns results"], best: "There are clear targets and room to run.", watch: "Process and detail can slip under pressure." },
  Connector: { line: "Builds relationships and keeps people aligned.", strengths: ["Client and team rapport", "Spots tension early", "Keeps handoffs moving"], best: "The work involves people and conversation.", watch: "Long stretches of solo, detail-heavy work." },
  Analyst: { line: "Careful and precise, wants to get it right.", strengths: ["Accuracy and QA", "Finds patterns in data", "Builds repeatable systems"], best: "There is time to check the work.", watch: "Constant interruptions and rushed deadlines." },
  Specialist: { line: "Deep in one craft, steady and consistent.", strengths: ["Craft quality", "Reliable pace", "Knows the tools inside out"], best: "The work is clear and focused on one thing.", watch: "Frequent switching between tasks." },
}
const TRAITS = ["Pace", "Detail", "Autonomy", "People"]

export function teamFitScore(c: Client) {
  const scored = c.fit.filter((f) => f.fit !== null)
  return { avg: scored.length ? Math.round(scored.reduce((n, f) => n + f.fit!, 0) / scored.length) : null, strong: scored.filter((f) => f.fit! >= 80).length, watch: scored.filter((f) => f.fit! < 65).length, surveyed: scored.length }
}

export function FitChart({ c }: { c: Client }) {
  const [sel, setSel] = useState<string | null>(null)
  const seat = (id: string) => c.seats.find((s) => s.id === id)!
  const root = c.fit.find((f) => f.seatId === c.seats[0].id)!
  const teams = Array.from(new Set(c.fit.filter((f) => f !== root).map((f) => f.team)))
  const sum = teamFitScore(c)
  const open = c.fit.find((f) => f.seatId === sel)
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {[[sum.avg ?? "–", "Team fit score", "Average fit to role, out of 100"], [sum.strong, "Strong fits", "80 or higher"], [sum.watch, "To watch", "Under 65"], [`${sum.surveyed}/${c.seats.length}`, "Surveys in", "Culture Intelligence"]].map(([v, k, n]) => (
          <div key={String(k)} className="flex flex-col gap-1 rounded-2xl border p-4"><span className="text-xs text-[var(--text-secondary)]">{k}</span><span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">{v}</span><span className="text-xs text-[var(--text-muted)]">{n}</span></div>
        ))}
      </div>

      <div className="flex flex-col items-center">
        <PersonCard p={root} s={seat(root.seatId)} onOpen={setSel} top />
        <span aria-hidden className="h-5 w-px bg-[var(--border)]" />
      </div>
      <div className="grid gap-4 border-t pt-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {teams.map((team) => {
          const people = c.fit.filter((f) => f.team === team && f !== root)
          const lead = people.find((p) => !p.reportsTo || p.reportsTo === root.seatId) ?? people[0]
          const rest = people.filter((p) => p !== lead)
          const scored = people.filter((p) => p.fit !== null)
          const avg = scored.length ? Math.round(scored.reduce((n, p) => n + p.fit!, 0) / scored.length) : null
          return (
            <div key={team} className="flex flex-col gap-2 rounded-[var(--radius-card)] border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{team}</span>
                <span className="text-xs text-[var(--text-muted)]">{people.length} people{avg !== null ? ` · fit ${avg}` : ""}</span>
              </div>
              <PersonCard p={lead} s={seat(lead.seatId)} onOpen={setSel} lead />
              {rest.length > 0 && <div className="ml-3 flex flex-col gap-2 border-l pl-3">{rest.map((p) => <PersonCard key={p.seatId} p={p} s={seat(p.seatId)} onOpen={setSel} />)}</div>}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-[var(--text-muted)]">Built once from your team&apos;s Culture Intelligence survey. New members sync in when they take it. Reference only, not the final design.</p>

      <Sheet open={!!open} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="right" className="gap-0 bg-[var(--page)] data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {open && <Profile c={c} p={open} s={seat(open.seatId)} seat={seat} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PersonCard({ p, s, onOpen, lead, top }: { p: FitPerson; s: Seat; onOpen: (id: string) => void; lead?: boolean; top?: boolean }) {
  const b = band(p.fit)
  return (
    <button onClick={() => onOpen(p.seatId)} className={cn("group flex items-center gap-3 rounded-xl border p-2.5 text-left transition hover:border-[var(--seq-500)]", top ? "min-w-64 bg-[var(--graphite)] text-white" : lead ? "bg-[var(--surface-2)]" : "bg-card")}>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-lg font-semibold tabular-nums", b.cls)} title={b.word}>{p.fit ?? "–"}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{s.name}</span>
        <span className={cn("truncate text-xs", top ? "text-white/60" : "text-[var(--text-muted)]")}>{lead ? `Lead · ${s.role}` : s.role}{p.profile ? ` · ${p.profile}` : ""}</span>
        {p.keyPerson && <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--delta-bad)]"><AlertTriangle className="size-3" />Key person</span>}
      </span>
      <ChevronRight aria-hidden className={cn("size-4 shrink-0 opacity-40 group-hover:opacity-100", top && "text-white")} />
    </button>
  )
}

function Profile({ c, p, s, seat }: { c: Client; p: FitPerson; s: Seat; seat: (id: string) => Seat }) {
  const b = band(p.fit)
  const prof = p.profile ? PROFILE[p.profile] : null
  const boss = p.reportsTo ? seat(p.reportsTo) : c.seats[0].id !== s.id ? c.seats[0] : null
  const reports = c.fit.filter((f) => f.reportsTo === p.seatId).map((f) => seat(f.seatId))
  return (
    <>
      <SheetHeader className="border-b bg-card">
        <SheetTitle className="text-lg font-semibold">{s.name}</SheetTitle>
        <SheetDescription className="text-xs">{s.role} · {p.team} · from Culture Intelligence</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 overflow-auto p-4">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <span className={cn("grid size-16 place-items-center rounded-2xl text-2xl font-semibold tabular-nums", b.cls)}>{p.fit ?? "–"}</span>
          <span className="flex flex-col gap-1"><span className="font-semibold">{b.word}</span><span className="text-sm text-[var(--text-secondary)]">{p.fit === null ? "Hasn't taken the survey yet. Their profile appears once they do." : `Fit to the ${s.role} role, out of 100.`}</span></span>
        </div>
        {prof && (
          <>
            <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
              <span className="text-xs text-[var(--text-muted)]">Profile</span>
              <span className="text-lg font-semibold">{p.profile}</span>
              <span className="text-sm text-[var(--text-secondary)]">{prof.line}</span>
              <div className="mt-1 flex flex-wrap gap-1.5">{prof.strengths.map((x) => <span key={x} className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs">{x}</span>)}</div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <span className="text-xs text-[var(--text-muted)]">How they compare to what the role needs</span>
              {TRAITS.map((t) => {
                const me = Math.round(25 + hash(s.id + t) * 70)
                const need = Math.round(30 + hash(s.role + t) * 60)
                return (
                  <div key={t} className="grid grid-cols-[72px_minmax(0,1fr)_64px] items-center gap-3 text-sm">
                    <span>{t}</span>
                    <span className="relative h-2 rounded-full bg-[var(--surface-2)]">
                      <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded bg-[var(--text-primary)]" style={{ left: `${need}%` }} />
                      <span aria-hidden className="absolute -top-0.5 size-3 -translate-x-1/2 rounded-full border-2 border-white bg-[var(--bronze)]" style={{ left: `${me}%` }} />
                    </span>
                    <span className="text-right text-xs tabular-nums text-[var(--text-muted)]">{Math.abs(me - need) <= 12 ? "Matches" : me > need ? "Above" : "Below"}</span>
                  </div>
                )
              })}
              <span className="flex gap-4 text-xs text-[var(--text-muted)]"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[var(--bronze)]" />{s.name.split(" ")[0]}</span><span className="flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-[var(--text-primary)]" />Role needs</span></span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card p-4"><div className="text-xs text-[var(--text-muted)]">Works best when</div><div className="mt-1 text-sm">{prof.best}</div></div>
              <div className="rounded-2xl border bg-card p-4"><div className="text-xs text-[var(--text-muted)]">Watch for</div><div className="mt-1 text-sm">{prof.watch}</div></div>
            </div>
          </>
        )}
        {p.note && <div className="rounded-2xl border bg-card p-4 text-sm"><div className="text-xs text-[var(--text-muted)]">From {p.note.by.split(" ")[0]}&apos;s interview</div><div className="mt-1">{p.note.text}</div></div>}
        <div className="flex flex-col gap-1.5 rounded-2xl border bg-card p-4 text-sm">
          <span className="text-xs text-[var(--text-muted)]">Place on the team</span>
          <span>Reports to {boss ? `${boss.name}, ${boss.role}` : "nobody (top of the chart)"}</span>
          {reports.length > 0 && <span>{reports.length} direct {reports.length === 1 ? "report" : "reports"}: {reports.map((r) => r.name.split(" ")[0]).join(", ")}</span>}
          {p.keyPerson && <span className="flex items-center gap-1.5 text-[var(--delta-bad)]"><AlertTriangle className="size-3.5" />Key person: a lot of the team&apos;s work runs through them.</span>}
        </div>
        <p className="text-xs text-[var(--text-muted)]">Reference only, not the final design.</p>
      </div>
    </>
  )
}

"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, CalendarClock, Download, Presentation, Radio, Users } from "lucide-react"
import { PersonPicker } from "@/components/person-picker"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GPill, Kpi, PageHeader, Pill, Segmented } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { addDays, fmt } from "@/lib/dates"
import { openActions, guarantees, requirements, risk, seatStats, stage, STAGES } from "@/lib/engine"
import { accessOf } from "@/lib/access"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export default function Pipeline() {
  const { s, assignClient } = useStore()
  const t = s.today
  const [view, setView] = useState<string>("list")
  const [owner, setOwner] = useState<string>("All")
  const [riskOnly, setRiskOnly] = useState(false)
  const demo = s.clients.find((c) => c.demo)
  const owners = ["All", ...Array.from(new Set(s.clients.map((c) => c.owner)))]

  const rows = s.clients.map((c) => ({ c, g: guarantees(c, t), r: risk(c, t), st: seatStats(c, t), reqs: requirements(c, t), stage: stage(c, t), next: openActions(s, c)[0] }))
  const shown = rows.filter((x) => (owner === "All" || x.c.owner === owner) && (!riskOnly || x.r.length))
  const atRisk = rows.filter((x) => x.r.length)
  const installsOpen = rows.filter((x) => x.g.n !== null && x.st.installed < x.st.scope)
  const checksSoon = rows.filter((x) => [x.g.day30, x.g.day90].some((d) => d && d >= t && d <= addDays(t, 14)))
  const gaps = rows.reduce((n, x) => n + x.st.silent, 0)
  const cols = STAGES.filter((st) => st.id !== "monthly" || rows.some((x) => x.stage === "monthly"))

  return (
    <>
      <PageHeader title="Clients" sub="Won deals arrive from the Aalpha CRM. Stages move on their own; risk is calculated."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="View" value={view} onChange={setView} options={[{ id: "list", label: "List" }, { id: "board", label: "Board" }]} />
            <Segmented label="Owner" value={owner} onChange={setOwner} options={owners.map((o) => ({ id: o, label: o }))} />
            {demo && <Link href={`/client/${demo.id}?role=Owner&tab=how&tour=0`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--graphite)] px-3.5 text-sm font-medium text-white hover:opacity-90"><Presentation className="size-4" />Start demo</Link>}
            <Button variant={riskOnly ? "default" : "outline"} className="h-10 rounded-xl px-3" onClick={() => setRiskOnly(!riskOnly)}><AlertTriangle /> At risk</Button>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-xs text-[var(--text-secondary)]" title="Won deals in the Aalpha CRM create the client here automatically"><span className="relative flex size-2"><span className="absolute inline-flex size-2 animate-ping rounded-full bg-[var(--status-good)] opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-[var(--status-good)]" /></span>Synced from Aalpha CRM</span>
          </div>
        } />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<Users />} hue="#2a78d6" label="Active clients" value={rows.length} note={`${rows.filter((x) => x.g.n === null).length} waiting on kickoff`} />
        <Kpi icon={<AlertTriangle />} hue="#e5484d" label="At risk" value={atRisk.length} t={atRisk.length ? "bad" : undefined} note={atRisk.map((x) => x.c.name.split(" ")[0]).join(", ") || "None"} />
        <Kpi icon={<Download />} hue="#eb6834" label="Installs incomplete" value={installsOpen.length} note={`${installsOpen.reduce((n, x) => n + x.st.scope - x.st.installed, 0)} seats missing`} />
        <Kpi icon={<CalendarClock />} hue="#6250d6" label="Guarantee checks, 14 days" value={checksSoon.length} note={checksSoon.map((x) => x.c.name.split(" ")[0]).join(", ") || "None"} />
        <Kpi icon={<Radio />} hue="#f0a400" label="Silent computers" value={gaps} t={gaps ? "warn" : undefined} note="No data for 2+ working hours" />
      </div>

      {view === "list" && (
        <section className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Client</TableHead><TableHead>Stage</TableHead><TableHead className="w-44">Progress</TableHead><TableHead>Owner</TableHead><TableHead>Day 30</TableHead><TableHead>Day 90</TableHead><TableHead className="text-right">Installed</TableHead><TableHead className="text-right">Req.</TableHead><TableHead className="pr-6">Next action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map(({ c, g, r, st, reqs, stage: sid, next }) => {
                  const missed = reqs.filter((q) => q.status === "missed").length
                  return (
                    <TableRow key={c.id} className="h-16">
                      <TableCell className="pl-6">
                        <Link href={`/clients/${c.id}`} className="flex items-center gap-2.5">
                          <span aria-hidden className={cn("size-2 rounded-full", r.length ? "bg-[var(--status-critical)]" : "bg-[var(--status-good)]")} />
                          <span className="flex flex-col"><span className="flex items-center gap-2 font-semibold hover:underline">{c.name}{c.demo && <Pill t="info">Sample</Pill>}</span><span className="text-xs text-[var(--text-muted)]">{r.length ? r[0] : "On track"}</span></span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--text-secondary)]">{STAGES.find((x) => x.id === sid)?.name}</TableCell>
                      <TableCell>
                        {g.n === null ? <span className="text-xs text-[var(--text-muted)]">Kickoff {c.kickoffBooked ? fmt(c.kickoffBooked) : "not booked"}</span> : (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs tabular-nums">Day {g.n} <span className="text-[var(--text-muted)]">/ 90</span></span>
                            <div className="relative h-1.5 w-36 rounded-full bg-[var(--surface-2)]"><div className="h-1.5 rounded-full bg-[var(--bronze)]" style={{ width: `${Math.min(100, (g.n / 90) * 100)}%` }} /><span aria-hidden className="absolute -top-0.5 h-2.5 w-px bg-[var(--text-muted)]" style={{ left: "33.3%" }} /></div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell><PersonPicker label={`Owner for ${c.name}`} value={c.owner} disabled={accessOf(s) !== "Admin"} onChange={(v) => assignClient(c.id, v)} /></TableCell>
                      <TableCell>{g.n === null ? <span className="text-xs text-[var(--text-muted)]">-</span> : <GPill g={g.d30} />}</TableCell>
                      <TableCell>{g.n === null ? <span className="text-xs text-[var(--text-muted)]">-</span> : <GPill g={g.d90} />}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", g.n !== null && st.installed < st.scope && "text-[var(--delta-bad)]")}>{g.n === null ? "-" : `${st.installed}/${st.scope}`}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", missed && "text-[var(--delta-bad)]")}>{g.n === null ? "-" : missed ? `${missed} missed` : `${reqs.filter((q) => q.status === "met").length}/7`}</TableCell>
                      <TableCell className="max-w-72 pr-6 text-xs"><span className="line-clamp-2">{next?.title ?? "Nothing open"}</span></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {view === "board" && (
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1100px] gap-4" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(180px, 1fr))` }}>
          {cols.map((col) => {
            const list = shown.filter((x) => x.stage === col.id)
            return (
              <div key={col.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{col.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{col.window}</div>
                  </div>
                  <span className="grid size-6 place-items-center rounded-full bg-card text-xs font-medium tabular-nums ring-1 ring-[var(--grid)]">{list.length}</span>
                </div>
                {list.length === 0 && <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-[var(--text-muted)]">Empty</div>}
                {list.map(({ c, g, r, st, reqs, next }) => {
                  const missed = reqs.filter((q) => q.status === "missed").length
                  const met = reqs.filter((q) => q.status === "met").length
                  const pct = g.n === null ? 0 : Math.min(100, (g.n / 90) * 100)
                  return (
                    <Link key={c.id} href={`/clients/${c.id}`}
                      className={cn("group flex flex-col gap-3 rounded-2xl border bg-card p-4 text-left transition hover:-translate-y-px hover:border-[var(--seq-500)]")}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{c.name}{c.demo && <Pill t="info" className="ml-2">Sample</Pill>}</span>
                        {r.length ? <Pill t="bad"><AlertTriangle className="size-3.5" />Risk</Pill> : <Pill t="good">On track</Pill>}
                      </div>

                      {g.n === null ? (
                        <span className="text-xs text-[var(--text-secondary)]">Signed {fmt(c.signedDate)} · kickoff {c.kickoffBooked ? fmt(c.kickoffBooked) : "not booked"}</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-baseline justify-between text-xs"><span className="font-medium tabular-nums">Day {g.n} <span className="text-[var(--text-muted)]">/ 90</span></span>{c.pauses.length > 0 && <span className="text-[var(--text-muted)]">{c.pauses.reduce((a, p) => a + p.days, 0)}d paused</span>}</div>
                          <div className="relative h-1.5 rounded-full bg-[var(--surface-2)]">
                            <div className="h-1.5 rounded-full bg-[var(--bronze)]" style={{ width: `${pct}%` }} />
                            <span aria-hidden className="absolute -top-0.5 h-2.5 w-px bg-[var(--text-muted)]" style={{ left: `${(30 / 90) * 100}%` }} />
                          </div>
                        </div>
                      )}

                      {g.n !== null && (
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <Stat k="Installed" v={`${st.installed}/${st.scope}`} bad={st.installed < st.scope && !!c.kickoffDate && t > addDays(c.kickoffDate, 2)} />
                          <Stat k="Requirements" v={missed ? `${missed} missed` : `${met}/7`} bad={missed > 0} />
                          <Stat k="Found / wk" v={`${g.found}h`} good={g.found >= 40} />
                          <Stat k="Back / wk" v={`${g.back}h`} good={g.back >= 40} />
                        </dl>
                      )}
                      {g.n !== null && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">D30 <GPill g={g.d30} /></span>
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">D90 <GPill g={g.d90} /></span>
                        </div>
                      )}
                      {next && (
                        <div className="border-t pt-3 text-xs leading-snug">
                          <span className="text-[var(--text-muted)]">Next</span>
                          <div className="mt-0.5 font-medium">{next.title}</div>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]"><span>{c.owner}</span><span className="font-mono">{c.linearKey}</span></div>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      )}
    </>
  )
}

function Stat({ k, v, good, bad }: { k: string; v: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[var(--text-muted)]">{k}</dt>
      <dd className={cn("text-sm font-semibold tabular-nums", good && "text-[var(--delta-good)]", bad && "text-[var(--delta-bad)]")}>{v}</dd>
    </div>
  )
}

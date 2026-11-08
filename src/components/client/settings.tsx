"use client"

// Client Settings. Owners control seats and access, what Shadow may and may not capture,
// when it records, connections and pay rates. Everyone controls their own recording:
// pause, hours, personal block and allow lists, what their manager sees, and their data.
// Capture rules mirror Shadow's real organization_capture_policies (allow and block, apps
// and domains); personal rules mirror the desktop app's local privacy settings.

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { AlertTriangle, Download, EyeOff, LifeBuoy, Lock, Plus, Trash2, Upload, X } from "lucide-react"
import { Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { addDays, fmtLong } from "@/lib/dates"
import { installed } from "@/lib/engine"
import { useStore } from "@/lib/store"
import { recStatus } from "@/lib/recording"
import type { Capture, Client, Role, Seat, SeatPrefs } from "@/lib/types"
import { cn } from "@/lib/utils"
import { download } from "@/lib/workbook"
import { newRequest } from "@/lib/requests"
import { scheduleFor } from "@/lib/client-data"
import { Textarea } from "@/components/ui/textarea"
import { BusinessProfileForm } from "./business"
import { OrgSettings } from "./org"
import { ChannelsPanel, ConnectorsPanel, ReportDelivery } from "./connect"
import { isExec } from "@/lib/setup"
import { homeTeam, seatsInScope, suggestFunction, teamsOf } from "@/lib/teams"
import { APP } from "@/lib/flags"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const SEES: Record<Role, string> = { Owner: "Everything, named people", Manager: "Their teams, named people", Member: "Their own time, team totals" }

/** Admin is Aalpha staff editing from the Studio cockpit: everything the owner can, logged. */
export type SettingsRole = Role | "Admin"

export function ClientSettings({ c, role, me }: { c: Client; role: SettingsRole; me?: Seat }) {
  const tabs = role === "Admin"
    ? [["business", "Business profile"], ["org", "Organization"], ["seats", "Seats and access"], ["capture", "Capture rules"], ["schedule", "Recording schedules"], ["connections", "Connections"], ["pay", "Pay rates"]]
    : role === "Owner"
    ? [["business", "Business profile"], ["org", "Organization"], ["seats", "Seats and access"], ["capture", "Capture rules"], ["schedule", "Recording schedules"], ["connections", "Connections"], ["pay", "Pay rates"], ["mine", "My settings"]]
    : role === "Manager" ? [["seats", "Seats and access"], ["schedule", "Recording schedules"], ["mine", "My settings"]] : [["mine", "My settings"]]
  // ?sub= opens one section directly (the guided tour uses it for Connections).
  const want = useSearchParams().get("sub")
  const [tab, setTab] = useState(tabs.some(([k]) => k === want) ? want! : tabs[0][0])
  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
          {tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)} className={cn("h-8 rounded-[9px] px-3 text-sm", tab === k ? "bg-[var(--graphite)] font-medium text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>{l}</button>)}
        </div>
      )}
      {tab === "business" && <BusinessProfileForm c={c} />}
      {tab === "org" && <OrgSettings c={c} />}
      {tab === "seats" && <Seats c={c} canEdit={role === "Owner" || role === "Admin"} />}
      {tab === "capture" && <CaptureRules c={c} />}
      {tab === "schedule" && <Schedule c={c} canTeam={role !== "Manager"} owner={role === "Owner"} scope={role === "Manager" && me ? seatsInScope(c, "Manager", me).map((x) => x.id) : null} />}
      {tab === "connections" && <Connections c={c} who={me?.name ?? "Aalpha"} isOwner={role === "Owner"} />}
      {tab === "pay" && <PayRates c={c} />}
      {tab === "mine" && me && role !== "Admin" && <Mine c={c} me={me} role={role} />}
    </div>
  )
}

// ── shared bits ─────────────────────────────────────────────────────────────

function ChipList({ label, items, onChange, placeholder, tone = "muted", disabled }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; tone?: "bad" | "good" | "muted"; disabled?: boolean }) {
  const [v, setV] = useState("")
  const add = () => { const x = v.trim(); if (x && !items.includes(x)) onChange([...items, x]); setV("") }
  const cls = tone === "bad" ? "bg-[var(--bad-bg)] text-[var(--delta-bad)]" : tone === "good" ? "bg-[var(--good-bg)] text-[var(--delta-good)]" : "bg-[var(--surface-2)] text-[var(--text-secondary)]"
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex min-h-10 flex-wrap gap-1.5 rounded-xl border bg-[var(--page)] p-2">
        {items.length === 0 && <span className="px-1 text-xs text-[var(--text-muted)]">None</span>}
        {items.map((x) => (
          <span key={x} className={cn("inline-flex h-7 items-center gap-1 rounded-full pl-2.5 pr-1 text-xs font-medium", cls)}>
            {x}
            {!disabled && <button aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((y) => y !== x))} className="grid size-5 place-items-center rounded-full hover:bg-black/5"><X className="size-3" /></button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
          <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="h-9 rounded-[10px]" aria-label={`Add to ${label}`} />
          <Button type="submit" variant="outline" className="h-9 rounded-[10px]"><Plus />Add</Button>
        </form>
      )}
    </div>
  )
}

function useClient(c: Client) {
  const { update } = useStore()
  return {
    setCapture: (patch: Partial<Capture>, text?: string) => update(c.id, (x, t) => ({ ...x, capture: { ...x.capture, ...patch }, log: text ? [{ date: t, text }, ...x.log] : x.log })),
    patch: (fn: (x: Client) => Client, text?: string) => update(c.id, (x, t) => ({ ...fn(x), log: text ? [{ date: t, text }, ...x.log] : x.log })),
  }
}

// ── owner: seats and access ─────────────────────────────────────────────────

function Seats({ c, canEdit }: { c: Client; canEdit: boolean }) {
  const { s } = useStore()
  const { patch } = useClient(c)
  const [name, setName] = useState("")
  const [jobRole, setJobRole] = useState("")
  const [team, setTeam] = useState("")
  const included = 50
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border bg-card p-5"><div className="text-xs text-[var(--text-secondary)]">Seats in use</div><div className="text-3xl font-semibold tabular-nums">{c.seats.length}<span className="text-base text-[var(--text-muted)]"> / {included}</span></div><div className="mt-2 h-1.5 rounded-full bg-[var(--surface-2)]"><div className="h-1.5 rounded-full bg-[var(--bronze)]" style={{ width: `${(c.seats.length / included) * 100}%` }} /></div></div>
        <div className="rounded-[var(--radius-card)] border bg-card p-5"><div className="text-xs text-[var(--text-secondary)]">Installed</div><div className="text-3xl font-semibold tabular-nums text-[var(--delta-good)]">{c.seats.filter((x) => installed(x, s.today)).length}</div><div className="text-xs text-[var(--text-muted)]">have the desktop app. Who is recording right now is on the Team page.</div></div>
        <div className="rounded-[var(--radius-card)] border bg-card p-5"><div className="text-xs text-[var(--text-secondary)]">Invited</div><div className="text-3xl font-semibold tabular-nums text-[var(--watch-fg)]">{c.seats.filter((x) => !installed(x, s.today)).length}</div><div className="text-xs text-[var(--text-muted)]">not installed yet</div></div>
      </div>
      <Section title="Seats and access" sub={canEdit ? "Who has a seat, and what they can see in this app" : "Only the owner can change access"}>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Job</TableHead><TableHead>Team</TableHead><TableHead>Executive</TableHead><TableHead>Status</TableHead><TableHead>Access</TableHead><TableHead>Can see</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {c.seats.map((x) => {
                const r = c.access[x.id] ?? "Member"
                return (
                  <TableRow key={x.id}>
                    <TableCell className="font-medium">{x.name}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{x.role}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{homeTeam(c, x)}</TableCell>
                    <TableCell><Switch aria-label={`${x.name} is an executive`} disabled={!canEdit} checked={isExec(x)} onCheckedChange={(v) => patch((y) => ({ ...y, seats: y.seats.map((z) => (z.id === x.id ? { ...z, exec: !!v } : z)) }), `${x.name} ${v ? "gets" : "no longer gets"} the Executive report.`)} /></TableCell>
                    <TableCell>{(() => { const st = recStatus(c, x, s.today).status; return <Pill t={st === "Recording" ? "good" : st === "On leave" || st === "Excluded" || st === "Paused" ? "muted" : "warn"}>{st}</Pill> })()}</TableCell>
                    <TableCell>
                      <Select value={r} disabled={!canEdit} onValueChange={(v) => v && patch((y) => ({ ...y, access: { ...y.access, [x.id]: v as Role } }), `${x.name} set to ${v}.`)}>
                        <SelectTrigger size="sm" className="h-8 w-28 rounded-[10px]" aria-label={`Access for ${x.name}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{(["Owner", "Manager", "Member"] as Role[]).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-[var(--text-secondary)]">{SEES[r]}</TableCell>
                    <TableCell className="text-right">{canEdit && x.id !== c.seats[0].id && <Button size="icon-sm" variant="ghost" aria-label={`Remove ${x.name}`} onClick={() => { if (window.confirm(`Remove ${x.name}'s seat? Their recording stops.`)) patch((y) => ({ ...y, seats: y.seats.filter((z) => z.id !== x.id), fit: y.fit.filter((z) => z.seatId !== x.id) }), `Seat removed: ${x.name}.`) }}><Trash2 /></Button>}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {canEdit && (
          <form className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4" onSubmit={(e) => { e.preventDefault(); if (!name.trim() || !team) return; const role = jobRole.trim() || "Team member"; const isPod = c.pods?.some((p) => p.name === team); patch((y) => { const id = `${y.id}-n${Date.now()}`; return { ...y, seats: [...y.seats, { id, name: name.trim(), role, installAt: null, consent: false, ciSurvey: false, team: isPod ? suggestFunction(role) : team, pod: isPod ? team : undefined }], access: { ...y.access, [id]: "Member" }, pay: { ...y.pay, [id]: 35 } } }, `Invited ${name.trim()} to ${team}.`); setName(""); setJobRole(""); setTeam("") }}>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Name<Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-48 rounded-[10px]" /></label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Job<Input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="Account manager" className="h-9 w-48 rounded-[10px]" /></label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Team (required)
              <Select value={team} onValueChange={(v) => v && setTeam(String(v))}>
                <SelectTrigger size="sm" className="h-9 w-48 rounded-[10px]" aria-label="Team"><span className="flex-1 text-left text-sm">{team || "Pick a team"}</span></SelectTrigger>
                <SelectContent>{teamsOf(c).map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <Button type="submit" disabled={!name.trim() || !team} className="h-9 rounded-[10px]"><Plus />Invite to a seat</Button>
          </form>
        )}
      </Section>
    </>
  )
}

// ── owner: capture rules ────────────────────────────────────────────────────

function CaptureRules({ c }: { c: Client }) {
  const { setCapture } = useClient(c)
  const k = c.capture
  return (
    <>
      <Section title={`What ${APP} may capture`} sub={`${APP} only sees the work apps and sites on this allowlist. Everything else is left out.`}>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChipList label="Work apps" items={k.allowApps} tone="good" placeholder="e.g. Figma" onChange={(v) => setCapture({ allowApps: v }, "Allowed apps updated.")} />
          <ChipList label="Work websites" items={k.allowDomains} tone="good" placeholder="e.g. app.hubspot.com" onChange={(v) => setCapture({ allowDomains: v }, "Allowed websites updated.")} />
        </div>
        <details className="mt-4 rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-medium">Always left out, even if someone adds them</summary>
          <div className="mt-3 grid gap-5 lg:grid-cols-2">
            <ChipList label="Apps" items={k.blockApps} tone="bad" placeholder="e.g. Messages" onChange={(v) => setCapture({ blockApps: v }, "Blocked apps updated.")} />
            <ChipList label="Websites" items={k.blockDomains} tone="bad" placeholder="e.g. *.bank.com" onChange={(v) => setCapture({ blockDomains: v }, "Blocked websites updated.")} />
          </div>
        </details>
      </Section>
      <Section title="What people can change themselves">
        {([["membersCanBlock", "People can leave out more apps and sites", "Their own list, on top of the team's. Everyone can always pause."]] as [keyof Capture, string, string][]).map(([key, l, d]) => (
          <label key={key} className="flex items-center justify-between gap-4 border-t py-3 first:border-t-0">
            <span className="flex flex-col"><span className="text-sm font-medium">{l}</span><span className="text-xs text-[var(--text-muted)]">{d}</span></span>
            <Switch checked={!!k[key]} onCheckedChange={(v) => setCapture({ [key]: !!v } as Partial<Capture>)} />
          </label>
        ))}
        <p className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]"><EyeOff className="size-3.5" />Private info is encrypted and redacted on the laptop before it&apos;s sent.</p>
      </Section>
    </>
  )
}

// ── owner: schedule ─────────────────────────────────────────────────────────

function Schedule({ c, canTeam, owner, scope }: { c: Client; canTeam: boolean; owner?: boolean; scope?: string[] | null }) {
  return (
    <>
      <p className="rounded-2xl border border-dashed bg-card px-4 py-3 text-sm text-[var(--text-secondary)]">Scheduled recording is coming soon. Set the hours now; until it ships, people pause by hand outside them.</p>
      {canTeam && <TeamWindow c={c} owner={!!owner} />}
      <PeopleSchedules c={c} owner={!!owner} scope={scope ?? null} />
      {canTeam && <ReportDelivery c={c} />}
    </>
  )
}

// Work hours, around the clock, or your own days and hours. Only an owner can turn on 24/7.
const PRESETS: { id: "work" | "247" | "custom"; label: string; days: number[]; start: string; end: string }[] = [
  { id: "work", label: "Work hours", days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" },
  { id: "247", label: "24/7", days: [1, 2, 3, 4, 5, 6, 7], start: "00:00", end: "23:59" },
  { id: "custom", label: "Custom", days: [], start: "", end: "" },
]
export const presetOf = (k: { preset?: string; days: number[]; start: string; end: string }) => k.preset ?? (k.days.length === 7 && k.start === "00:00" ? "247" : "work")

function PresetPicker({ value, owner, onPick, label }: { value: string; owner: boolean; onPick: (p: (typeof PRESETS)[number]) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-fit rounded-xl border p-1">
      {PRESETS.map((p) => <button key={p.id} role="radio" aria-checked={value === p.id} disabled={p.id === "247" && !owner} title={p.id === "247" && !owner ? "Only an owner can set 24/7" : undefined} onClick={() => onPick(p)} className={cn("h-8 rounded-[9px] px-3 text-sm disabled:opacity-40", value === p.id ? "bg-[var(--graphite)] font-medium text-white" : "text-[var(--text-secondary)]")}>{p.label}</button>)}
    </div>
  )
}

function PeopleSchedules({ c, owner, scope }: { c: Client; owner: boolean; scope: string[] | null }) {
  const { patch } = useClient(c)
  const set = (id: string, v: Client["schedules"][string] | null, who: string) => patch((y) => { const n = { ...y.schedules }; if (v) n[id] = v; else delete n[id]; return { ...y, schedules: n } }, v ? `Schedule for ${who}: ${v.start} to ${v.end}.` : `${who} back on the team schedule.`)
  return (
    <Section title="Each person's schedule" sub={`Set by the owner or a manager. ${APP} records each person only inside their own hours. People can narrow theirs, never widen it.`}>
      <div className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Preset</TableHead><TableHead>Days</TableHead><TableHead>Hours</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {c.seats.filter((x) => !scope || scope.includes(x.id)).map((x) => {
              const own = !!c.schedules[x.id]
              const k = scheduleFor(c, x.id)
              const put = (q: Partial<typeof k>) => set(x.id, { ...k, ...q }, x.name)
              return (
                <TableRow key={x.id}>
                  <TableCell><span className="flex flex-col"><span className="font-medium">{x.name}</span><span className="text-xs text-[var(--text-muted)]">{x.role}</span></span></TableCell>
                  <TableCell><PresetPicker label={`Preset for ${x.name}`} owner={owner} value={presetOf(k)} onPick={(p) => put(p.id === "custom" ? { preset: "custom" } : { preset: p.id, days: p.days, start: p.start, end: p.end })} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {DAYS.map((d, i) => { const n = i + 1; const on = k.days.includes(n); return <button key={d} aria-pressed={on} aria-label={`${x.name} ${d}`} onClick={() => put({ days: on ? k.days.filter((z) => z !== n) : [...k.days, n].sort() })} className={cn("h-7 w-9 rounded-[8px] border text-xs", on ? "border-[var(--bronze)] bg-[var(--seq-100)] font-medium text-[var(--seq-900)]" : "text-[var(--text-muted)]")}>{d[0]}{d[1]}</button> })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Input type="time" value={k.start} onChange={(e) => put({ start: e.target.value })} className="h-8 w-28 rounded-[10px]" aria-label={`${x.name} start`} />
                      <span className="text-xs text-[var(--text-muted)]">to</span>
                      <Input type="time" value={k.end} onChange={(e) => put({ end: e.target.value })} className="h-8 w-28 rounded-[10px]" aria-label={`${x.name} end`} />
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{own ? <Button size="sm" variant="ghost" onClick={() => set(x.id, null, x.name)}>Use team default</Button> : <span className="text-xs text-[var(--text-muted)]">Team default</span>}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Section>
  )
}

function TeamWindow({ c, owner }: { c: Client; owner: boolean }) {
  const { setCapture } = useClient(c)
  const k = c.capture
  return (
    <Section title="Team default" sub="Used for anyone without their own schedule.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Recording hours</span>
          <PresetPicker label="Team recording hours" owner={owner} value={presetOf(k)} onPick={(p) => setCapture(p.id === "custom" ? { preset: "custom" } : { preset: p.id, days: p.days, start: p.start, end: p.end }, `Team recording set to ${p.label}.`)} />
          {presetOf(k) === "247" && <span className="text-xs text-[var(--watch-fg)]">Recording 24/7. Everyone sees a banner and can pause any time.</span>}
          {!owner && <span className="text-xs text-[var(--text-muted)]">Only an owner can set 24/7.</span>}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Days</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => { const n = i + 1; const on = k.days.includes(n); return <button key={d} aria-pressed={on} onClick={() => setCapture({ days: on ? k.days.filter((x) => x !== n) : [...k.days, n].sort() })} className={cn("h-9 w-12 rounded-[10px] border text-sm", on ? "border-[var(--bronze)] bg-[var(--seq-100)] font-medium text-[var(--seq-900)]" : "text-[var(--text-secondary)]")}>{d}</button> })}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Starts<Input type="time" value={k.start} onChange={(e) => setCapture({ start: e.target.value })} className="h-9 w-36 rounded-[10px]" /></label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Ends<Input type="time" value={k.end} onChange={(e) => setCapture({ end: e.target.value })} className="h-9 w-36 rounded-[10px]" /></label>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">How often</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["continuous", "Continuous", "Every working day. Used for the first month."], ["windows", "Two weeks a month", "From month two. Enough to re-measure, half the footprint."]] as [Capture["mode"], string, string][]).map(([m, l, d]) => (
              <button key={m} aria-pressed={k.mode === m} onClick={() => setCapture({ mode: m }, `Recording set to ${l.toLowerCase()}.`)} className={cn("flex flex-col gap-1 rounded-2xl border p-4 text-left", k.mode === m ? "border-[var(--bronze)] bg-[var(--seq-100)]" : "hover:bg-[var(--surface-2)]")}>
                <span className="text-sm font-semibold">{l}</span><span className="text-xs text-[var(--text-secondary)]">{d}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

// ── owner: connections ──────────────────────────────────────────────────────

function Connections({ c, who, isOwner }: { c: Client; who: string; isOwner: boolean }) {
  const { patch } = useClient(c)
  const k = c.connections
  const set = (p: Partial<Client["connections"]>, text: string) => patch((y) => ({ ...y, connections: { ...y.connections, ...p } }), text)
  return (
    <>
      <ConnectorsPanel c={c} who={who} isOwner={isOwner} />
      <ChannelsPanel c={c} who={who} isOwner={isOwner} />
      <Section title="Payroll" sub="Turns hours into dollars at each person's real pay rate">
        <div className="flex flex-wrap items-center gap-2">
          {([["none", "Not connected"], ["csv", "CSV upload"], ["api", "Payroll API (Gusto, Rippling)"]] as [Client["connections"]["payroll"], string][]).map(([m, l]) => (
            <button key={m} aria-pressed={k.payroll === m} onClick={() => set({ payroll: m }, `Payroll: ${l}.`)} className={cn("h-9 rounded-[10px] border px-3 text-sm", k.payroll === m ? "border-[var(--bronze)] bg-[var(--seq-100)] font-medium text-[var(--seq-900)]" : "text-[var(--text-secondary)]")}>{l}</button>
          ))}
          {k.payroll === "csv" && <Button variant="outline" className="h-9 rounded-[10px]" onClick={() => patch((y) => y, "Payroll CSV uploaded (prototype).")}><Upload />Upload new CSV</Button>}
        </div>
      </Section>
    </>
  )
}

/** A person's own consent record, and the way to withdraw it. Withdrawing stops their recording. */
function ConsentRecord({ c, me }: { c: Client; me: Seat }) {
  const { update } = useStore()
  return (
    <Section title="Your consent" sub="What you agreed to, and when">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex-1">{me.consent ? `You agreed to ${me.consentVersion ?? c.consentVersion ?? "the consent form"}${me.consentAt ? ` on ${fmtLong(me.consentAt)}` : ""}.` : "You haven't agreed to the consent form, so nothing is recorded for you."}</span>
        {me.consent && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => { if (window.confirm(`Withdraw your consent? ${APP} stops recording you, and your owner is told.`)) update(c.id, (x, t) => ({ ...x, seats: x.seats.map((y) => (y.id === me.id ? { ...y, consent: false, consentVersion: null } : y)), log: [{ date: t, text: `${me.name} withdrew consent. Recording stopped for them.` }, ...x.log] })) }}>Withdraw consent</Button>}
      </div>
    </Section>
  )
}

// ── owner: pay rates ────────────────────────────────────────────────────────

function PayRates({ c }: { c: Client }) {
  const { patch } = useClient(c)
  const [seat, setSeat] = useState(c.seats[0]?.id ?? "")
  const [read, setRead] = useState<string | null>(null)
  // Prototype: pretend to read gross pay and hours from the stub. The real build parses
  // the PDF server side, keeps only the hourly figure, and deletes the file.
  const onStub = (f: File | undefined) => {
    if (!f || !seat) return
    const who = c.seats.find((x) => x.id === seat)!
    const base = c.pay[seat] ?? 38
    const hours = 80
    const gross = Math.round(base * hours * (0.96 + (f.size % 9) / 100))
    const rate = Math.round((gross / hours) * 1.18)
    patch((y) => ({ ...y, pay: { ...y.pay, [seat]: rate }, paySrc: { ...(y.paySrc ?? {}), [seat]: "Pay stub" } }), `Pay stub read for ${who.name}: $${rate}/h loaded. File discarded.`)
    setRead(`${who.name}: $${gross.toLocaleString()} gross for ${hours} hours, plus 18% taxes and benefits = $${rate} an hour. The stub was not kept.`)
  }
  return (
    <>
    <Section title="Add a pay stub" sub="No payroll connection? Upload one recent stub per person. We read the gross pay and hours, keep only the hourly cost, and delete the file.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Person
          <Select value={seat} onValueChange={(v) => v && setSeat(v)}>
            <SelectTrigger className="h-9 w-56 rounded-[10px]" aria-label="Person for pay stub"><SelectValue>{c.seats.find((x) => x.id === seat)?.name}</SelectValue></SelectTrigger>
            <SelectContent>{c.seats.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-sm hover:bg-[var(--surface-2)]"><Upload className="size-4" />Upload stub (PDF or image)<input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => { onStub(e.target.files?.[0]); e.target.value = "" }} /></label>
      </div>
      {read && <p className="mt-3 rounded-xl bg-[var(--good-bg)] p-3 text-sm text-[var(--delta-good)]">{read}</p>}
    </Section>
    <Section title="Pay rates" sub={c.connections.payroll === "none" ? "Payroll not connected: dollar values use a $38 an hour estimate. Rates here are only used once payroll is on." : `From payroll (${c.connections.payroll === "csv" ? "CSV" : "API"}). Loaded hourly cost per person. Owners only.`}>
      <div className="overflow-x-auto">
        <Table className="min-w-[520px]">
          <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Job</TableHead><TableHead>Source</TableHead><TableHead className="text-right">$ an hour</TableHead></TableRow></TableHeader>
          <TableBody>
            {c.seats.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell><TableCell className="text-[var(--text-secondary)]">{x.role}</TableCell>
                <TableCell><Pill t={c.paySrc?.[x.id] === "Pay stub" ? "info" : c.connections.payroll !== "none" ? "good" : "muted"}>{c.paySrc?.[x.id] ?? (c.connections.payroll !== "none" ? "Payroll" : "Estimate")}</Pill></TableCell>
                <TableCell className="text-right"><Input type="number" value={c.pay[x.id] ?? 38} onChange={(e) => patch((y) => ({ ...y, pay: { ...y.pay, [x.id]: Number(e.target.value) } }))} className="ml-auto h-8 w-24 rounded-[10px] text-right tabular-nums" aria-label={`Rate for ${x.name}`} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
    </>
  )
}

// ── everyone: my settings ───────────────────────────────────────────────────

function Mine({ c, me, role }: { c: Client; me: Seat; role: Role }) {
  const { s, mutate } = useStore()
  const { patch } = useClient(c)
  const [from, setFrom] = useState(addDays(s.today, -1))
  const [help, setHelp] = useState("")
  const [kind, setKind] = useState<"Question" | "Bug" | "Change">("Question")
  const win = scheduleFor(c, me.id)
  const mine = s.requests.filter((r) => r.clientId === c.id && r.from === me.name)
  const ask = (k: "Question" | "Bug" | "Change" | "Data deletion", title: string, detail = "") => mutate((x) => newRequest(x, { clientId: c.id, from: me.name, source: role === "Member" ? "Member" : "Client app", kind: k, title, detail, priority: k === "Bug" ? "High" : "Normal", assignee: c.owner }))
  const teamBlocks = [...c.capture.blockApps, ...c.capture.blockDomains].map((x) => x.toLowerCase())
  const p: SeatPrefs = c.prefs[me.id] ?? { pausedUntil: null, start: null, end: null, block: [], allow: [] }
  const setP = (q: Partial<SeatPrefs>, text?: string) => patch((y) => ({ ...y, prefs: { ...y.prefs, [me.id]: { ...p, ...q } } }), text)
  const conflicts = p.allow.filter((x) => teamBlocks.includes(x.toLowerCase()))
  const paused = !!p.pausedUntil && p.pausedUntil > s.today
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Recording" sub={`For ${me.name}`}>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-2)] p-4">
          <span className="flex flex-col"><span className="text-sm font-semibold">{paused ? "Paused" : "Recording"}</span><span className="text-xs text-[var(--text-muted)]">{paused ? `Until ${fmtLong(p.pausedUntil!)}` : `${p.start ?? win.start} to ${p.end ?? win.end}, ${win.days.map((d) => DAYS[d - 1]).join(" ")}`}</span></span>
          {true
            ? <div className="flex gap-2">{paused ? <Button size="sm" className="rounded-[10px]" onClick={() => setP({ pausedUntil: null })}>Resume</Button> : <><Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setP({ pausedUntil: addDays(s.today, 1) })}>Pause today</Button><Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setP({ pausedUntil: addDays(s.today, 7) })}>Pause a week</Button></>}</div>
            : <span className="text-xs text-[var(--text-muted)]">Your owner turned pausing off</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">My start<Input type="time" value={p.start ?? win.start} min={win.start} onChange={(e) => setP({ start: e.target.value < win.start ? win.start : e.target.value })} className="h-9 w-36 rounded-[10px]" /></label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">My end<Input type="time" value={p.end ?? win.end} max={win.end} onChange={(e) => setP({ end: e.target.value > win.end ? win.end : e.target.value })} className="h-9 w-36 rounded-[10px]" /></label>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{c.schedules[me.id] ? "Inside the hours your manager set for you" : "Inside the team hours"}: {win.start} to {win.end}. You can narrow these, not widen them.</p>
      </Section>
      <ConsentRecord c={c} me={me} />
      <Section title="What your manager sees" sub="And what nobody sees">
        <div className="flex flex-col gap-2 text-sm">
          {[["Time by type of work and app, as totals", true], ["Workflows you repeat, named", true], ["Screenshots and window titles", false], ["Anything in a blocked app or website", false], ["Private info (redacted on your laptop)", false], ["Your Slack messages in public channels and private channels the workspace admin is in, as team totals", true], ["Your Slack direct messages", false]].map(([k, v]) => (
            <span key={String(k)} className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0"><span>{k}</span>{v ? <Pill t="info">Visible</Pill> : <Pill t="good"><Lock className="size-3" />Never shown</Pill>}</span>
          ))}
        </div>
      </Section>
      <Section title="Take off my allowlist" sub={c.capture.membersCanBlock ? `Apps and sites from the team allowlist that ${APP} should skip for you.` : "Your owner manages the team allowlist"}>
        <ChipList label="Apps and websites" items={p.block} tone="bad" disabled={!c.capture.membersCanBlock} placeholder="e.g. personal Gmail" onChange={(v) => setP({ block: v }, `${me.name} updated their block list.`)} />
        <p className="mt-3 text-xs text-[var(--text-muted)]">The team also blocks: {[...c.capture.blockApps, ...c.capture.blockDomains].slice(0, 5).join(", ")}{c.capture.blockApps.length + c.capture.blockDomains.length > 5 ? "…" : ""}</p>
      </Section>
      <Section title="Suggest for the allowlist" sub="A work tool that's missing. Your owner decides; nothing outside the allowlist is captured.">
        <ChipList label="Apps and websites" items={p.allow} tone="good" placeholder="e.g. Notion" onChange={(v) => setP({ allow: v })} />
        {conflicts.length > 0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--watch-bg)] p-3 text-xs text-[var(--watch-fg)]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{conflicts.join(", ")} {conflicts.length > 1 ? "are" : "is"} blocked for the whole team. The team block wins, so {conflicts.length > 1 ? "they stay" : "it stays"} off.</p>}
      </Section>
      <Section title="My data" sub="Yours to see and remove" className="lg:col-span-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Delete everything captured on<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-44 rounded-[10px]" /></label>
          <Button variant="outline" className="h-9 rounded-[10px]" disabled={mine.some((r) => r.kind === "Data deletion" && r.status === "Waiting on approval" && r.title.endsWith(fmtLong(from)))} onClick={() => ask("Data deletion", `Delete ${me.name}'s data for ${fmtLong(from)}`, `${me.name} asked to delete everything captured on ${fmtLong(from)}.`)}><Trash2 />Request deletion</Button>
          <Button variant="outline" className="h-9 rounded-[10px]" onClick={() => download(`${me.name.toLowerCase().replace(/\s+/g, "-")}-shadow-settings.json`, JSON.stringify({ person: me.name, recording: p, team: { start: c.capture.start, end: c.capture.end } }, null, 2), "application/json")}><Download />Download my settings</Button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">Deletions go to Subhan for approval, so a mistake can&apos;t wipe the team&apos;s baseline. You&apos;ll see the answer here.</p>
      </Section>
      <Section title="Get help" sub="Ask a question, report a problem or ask for a change. Subhan answers here." className="lg:col-span-2">
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (!help.trim()) return; ask(kind === "Question" && /broken|bug|wrong|error|not working|doesn.t work|crash|stuck/i.test(help) ? "Bug" : kind, help.trim().slice(0, 80), help.trim()); setHelp("") }}>
          <div className="flex flex-wrap gap-1.5">{(["Question", "Bug", "Change"] as const).map((k) => <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("h-8 rounded-[9px] border px-3 text-sm", kind === k ? "border-[var(--bronze)] bg-[var(--seq-100)] font-medium text-[var(--seq-900)]" : "text-[var(--text-secondary)]")}>{k === "Bug" ? "Something's broken" : k === "Change" ? "Ask for a change" : "Question"}</button>)}</div>
          <Textarea value={help} onChange={(e) => setHelp(e.target.value)} placeholder="What do you need?" className="min-h-20 rounded-xl text-sm" />
          <Button type="submit" disabled={!help.trim()} className="self-start rounded-[10px]"><LifeBuoy />Send</Button>
        </form>
        {mine.length > 0 && (
          <div className="mt-4 flex flex-col border-t pt-3">
            <span className="mb-1 text-xs text-[var(--text-muted)]">My requests</span>
            {mine.map((r) => (
              <div key={r.id} className="flex flex-col gap-1 border-t py-2.5 first:border-t-0">
                <span className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{r.title}</span><Pill t={r.status === "Done" ? "good" : r.status === "Declined" ? "muted" : r.status === "Waiting on approval" ? "warn" : "info"}>{r.status === "Sent to Linear" ? "With the dev team" : r.status}</Pill></span>
                {r.thread.filter((m) => !m.text.startsWith("Sent to the dev team") && !m.text.startsWith("Linear ") && !m.text.startsWith("Assigned")).slice(-1).map((m, i) => <span key={i} className="text-xs text-[var(--text-secondary)]">{m.who}: {m.text}</span>)}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

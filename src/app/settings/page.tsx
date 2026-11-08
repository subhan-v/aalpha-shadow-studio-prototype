"use client"

import Link from "next/link"
import { useState } from "react"
import { Plus, ShieldCheck, Trash2 } from "lucide-react"
import { PageHeader, Pill, Section } from "@/components/bits"
import { initials } from "@/components/person-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmt } from "@/lib/dates"
import { useStore } from "@/lib/store"
import { ACCESS, accessOf } from "@/lib/access"
import type { Access, Settings } from "@/lib/types"

const FIELDS: [keyof Settings, string, string][] = [
  ["seatFloor", "Seat floor", "Fewer people sending data than this is critical (the guarantees need 15+)"],
  ["silentHours", "Silent computer", "Working hours with no data before an alert"],
  ["uploadDropPct", "Upload drop %", "Drop against a computer's 7-day average"],
  ["failurePct", "Failure spike %", "Share of analyses failing in an hour"],
  ["queueHours", "Queue stuck (hours)", "Age of the oldest waiting analysis"],
  ["costSpikeX", "Cost spike (x)", "Times a computer's 7-day average cost"],
  ["costTargetMax", "Cost target ($/person/day)", "Above this, a client shows as above target"],
]

export default function SettingsPage() {
  const { s, mutate } = useStore()
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [access, setAccess] = useState<Access>("Specialist")
  const admin = accessOf(s) === "Admin"
  const admins = s.team.filter((m) => m.access === "Admin").length
  const owned = (n: string) => s.clients.filter((c) => c.owner === n).length
  const onCount = (n: string) => s.clients.filter((c) => c.staff?.includes(n)).length

  return (
    <>
      <PageHeader title="Settings" sub="Team, access and alert rules. Changes apply to every client." />
      <Section title="Sign-in" sub="Studio is Aalpha only">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <ShieldCheck className="size-5 text-[var(--bronze)]" />
          <span>Signed in as <b>{s.me}</b> · {accessOf(s)}.</span>
          <Pill t="muted">Slack sign-in comes later</Pill>
        </div>
      </Section>

      <Section title="Team and access" sub={admin ? "Who can own clients, and what each person can do. Only Admins change this." : "Only Admins can change who has access."}>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {ACCESS.map((a) => <div key={a.id} className="flex flex-col gap-0.5 rounded-xl bg-[var(--surface-2)] p-3"><span className="text-sm font-medium">{a.id}</span><span className="text-xs text-[var(--text-secondary)]">{a.does}</span></div>)}
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Role</TableHead><TableHead>Access</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Owns</TableHead><TableHead className="text-right">Also on</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {s.team.map((m) => (
                <TableRow key={m.id}>
                  <TableCell><span className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-[var(--seq-100)] text-xs font-semibold text-[var(--seq-900)]">{initials(m.name)}</span><span className="font-medium">{m.name}</span></span></TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{m.role}</TableCell>
                  <TableCell>
                    {/* The last Admin can't be demoted, so Studio is never left without one. */}
                    <select value={m.access ?? "Viewer"} disabled={!admin || (m.access === "Admin" && admins === 1)} aria-label={`Access for ${m.name}`}
                      onChange={(e) => mutate((p) => ({ ...p, team: p.team.map((x) => (x.id === m.id ? { ...x, access: e.target.value as Access } : x)) }))}
                      className="h-8 rounded-[10px] border bg-card px-2 text-sm disabled:opacity-60">
                      {ACCESS.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                    </select>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-muted)]">{m.email}</TableCell>
                  <TableCell className="text-right tabular-nums">{owned(m.name)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.access === "Admin" ? <span className="text-xs text-[var(--text-muted)]">Sees all</span> : onCount(m.name)}</TableCell>
                  <TableCell className="text-right">{admin && owned(m.name) === 0 && onCount(m.name) === 0 && m.name !== s.me && <Button size="icon-sm" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => mutate((p) => ({ ...p, team: p.team.filter((x) => x.id !== m.id) }))}><Trash2 /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {admin && <form className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; mutate((p) => ({ ...p, team: [...p.team, { id: `m${Date.now()}`, name: name.trim(), role: role.trim() || "Delivery", email: `${name.trim().toLowerCase().split(" ")[0]}@aalpha.ai`, access }] })); setName(""); setRole("") }}>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Name<Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-48 rounded-[10px]" /></label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Role<Input value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-48 rounded-[10px]" placeholder="Delivery" /></label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Access
            <select value={access} onChange={(e) => setAccess(e.target.value as Access)} className="h-9 rounded-[10px] border bg-card px-2 text-sm text-[var(--text-primary)]">{ACCESS.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}</select>
          </label>
          <Button type="submit" className="h-9 rounded-[10px]"><Plus />Add person</Button>
        </form>}
      </Section>

      <Section title="Alert rules" sub={admin ? "Used by Alerts and every client's next actions" : "Used by Alerts and every client's next actions. Only Admins change these."}>
        <div className="grid gap-3 md:grid-cols-2">
          {FIELDS.filter(([k]) => admin || k !== "costTargetMax").map(([k, label, help]) => (
            <label key={k} className="flex items-center justify-between gap-4 rounded-xl border p-3">
              <span className="flex flex-col"><span className="text-sm font-medium">{label}</span><span className="text-xs text-[var(--text-muted)]">{help}</span></span>
              <Input type="number" step="any" disabled={!admin} key={`${k}-${s.settings[k]}`} defaultValue={s.settings[k]} onBlur={(e) => { const v = Number(e.target.value); if (v !== s.settings[k]) mutate((p) => ({ ...p, settings: { ...p.settings, [k]: v } })) }} className="h-9 w-24 rounded-[10px] text-right tabular-nums" />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Connections" sub="Where the rest of the work lives">
        <div className="grid gap-3 md:grid-cols-3">
          {[["Linear", "Tasks. One team per client, shown in each cockpit."], ["Aalpha CRM", "Sales. A won deal creates the client here; renewal opens at day 75."], ["Slack", "Alerts to each client's internal channel and #shadow-alerts."]].map(([n, d]) => (
            <div key={n} className="flex flex-col gap-2 rounded-xl border p-4"><span className="flex items-center justify-between text-sm font-medium">{n}<Pill t="muted">Not connected</Pill></span><span className="text-xs text-[var(--text-muted)]">{d}</span></div>
          ))}
        </div>
      </Section>

      <Section title="View-as log" sub="Every time someone opened a client's app">
        {s.viewLog.length === 0 ? <p className="py-2 text-sm text-[var(--text-muted)]">No views yet. Use “View as client” in a cockpit.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Who</TableHead><TableHead>Client</TableHead><TableHead>Viewed as</TableHead></TableRow></TableHeader>
            <TableBody>
              {s.viewLog.map((v, i) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{fmt(v.at)}</TableCell><TableCell>{v.who}</TableCell><TableCell><Link className="hover:underline" href={`/clients/${v.clientId}`}>{s.clients.find((c) => c.id === v.clientId)?.name}</Link></TableCell><TableCell>{v.role}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  )
}

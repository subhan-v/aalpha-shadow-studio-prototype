"use client"

import { X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { accessOf } from "@/lib/access"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Pick an Aalpha team member. Used to assign a client or a single action. */
export function PersonPicker({ value, onChange, label, className, disabled }: { value: string; onChange: (v: string) => void; label: string; className?: string; disabled?: boolean }) {
  const { s } = useStore()
  const names = Array.from(new Set([...s.team.map((m) => m.name), value]))
  return (
    <Select disabled={disabled} value={value} onValueChange={(v) => v && onChange(String(v))}>
      <SelectTrigger aria-label={label} size="sm" className={cn("h-8 min-w-32 rounded-[10px] bg-card text-xs", className)}>
        <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[var(--seq-100)] text-xs font-semibold text-[var(--seq-900)]">{initials(value)}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {names.map((n) => (
          <SelectItem key={n} value={n}>{n}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
}

/** Who else works a client, beside the owner. Only Admins add or remove people. */
export function StaffPicker({ c }: { c: Client }) {
  const { s, update } = useStore()
  const admin = accessOf(s) === "Admin"
  const on = c.staff ?? []
  const free = s.team.filter((m) => m.name !== c.owner && !on.includes(m.name))
  const set = (staff: string[], text: string) => update(c.id, (x, d) => ({ ...x, staff, log: [{ date: d, text: `${text} (${s.me}).` }, ...x.log] }))
  return (
    <span className="flex flex-wrap items-center gap-1">
      {on.map((n) => (
        <span key={n} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border bg-card pl-1 pr-2 text-xs">
          <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-semibold">{initials(n)}</span>{n}
          {admin && <button aria-label={`Take ${n} off ${c.name}`} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={() => set(on.filter((x) => x !== n), `${n} taken off the client`)}><X className="size-3.5" /></button>}
        </span>
      ))}
      {admin && free.length > 0 && (
        <select aria-label={`Add someone to ${c.name}`} value="" onChange={(e) => e.target.value && set([...on, e.target.value], `${e.target.value} added to the client`)} className="h-8 rounded-[10px] border border-dashed bg-card px-2 text-xs text-[var(--text-secondary)]">
          <option value="">+ Add person</option>
          {free.map((m) => <option key={m.id} value={m.name}>{m.name} · {m.access ?? "Viewer"}</option>)}
        </select>
      )}
    </span>
  )
}

"use client"

// Audit trail: every change anyone on the Aalpha team made in Studio, newest first, with the
// access they had at the time. Filter by person, client or area, or download it as CSV.

import Link from "next/link"
import { useState } from "react"
import { Download } from "lucide-react"
import { PageHeader, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmt } from "@/lib/dates"
import { useStore } from "@/lib/store"

const SHOW = 200
const sel = "h-9 rounded-[10px] border bg-card px-2 text-sm"

export default function AuditPage() {
  const { s } = useStore()
  const all = s.audit ?? []
  const [who, setWho] = useState("all")
  const [client, setClient] = useState("all")
  const [area, setArea] = useState("all")
  const [q, setQ] = useState("")
  const name = (id: string | null) => (id ? s.clients.find((c) => c.id === id)?.name ?? "Removed client" : "")
  const list = all.filter((e) => (who === "all" || e.by === who) && (client === "all" || e.clientId === client) && (area === "all" || e.area === area) && (!q || e.text.toLowerCase().includes(q.toLowerCase())))
  const areas = Array.from(new Set(all.map((e) => e.area))).sort()
  const csv = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = [["Date", "Time", "Who", "Access", "Where", "Client", "Area", "Change"], ...list.map((e) => [e.at, e.time, e.by, e.access, e.via ?? "Studio", name(e.clientId), e.area, e.text])]
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" }))
    const a = document.createElement("a"); a.href = url; a.download = `studio-audit-${s.today}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader title="Audit trail" sub="Every change made in Studio: who, with what access, when, and to what. Nobody can edit or delete it."
        right={<Button variant="outline" className="h-10 rounded-xl" disabled={!list.length} onClick={csv}><Download />Download CSV</Button>} />
      <div className="flex flex-wrap items-end gap-2">
        <select aria-label="Person" value={who} onChange={(e) => setWho(e.target.value)} className={sel}><option value="all">Everyone</option>{s.team.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}</select>
        <select aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)} className={sel}><option value="all">All clients</option>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className={sel}><option value="all">All areas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <Input aria-label="Search changes" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-48 rounded-[10px]" />
      </div>
      <Section title={`${list.length.toLocaleString()} ${list.length === 1 ? "change" : "changes"}`} sub={list.length > SHOW ? `Showing the newest ${SHOW}. Download the CSV for all of them.` : "Newest first"}>
        {all.length === 0 ? <p className="py-4 text-sm text-[var(--text-secondary)]">Nothing yet. The trail starts with the next change anyone makes. Older history is in each client&apos;s Log.</p>
          : list.length === 0 ? <p className="py-4 text-sm text-[var(--text-secondary)]">No changes match these filters.</p> : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Client</TableHead><TableHead>Area</TableHead><TableHead>Change</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.slice(0, SHOW).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{fmt(e.at)} · {e.time}</TableCell>
                    <TableCell className="whitespace-nowrap"><span className="flex items-center gap-2">{e.by}<Pill t={e.access === "Admin" ? "info" : "muted"}>{e.access}</Pill></span>{e.via && <span className="block text-xs text-[var(--text-muted)]">In the {e.via}</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.clientId ? <Link className="hover:underline" href={`/clients/${e.clientId}?tab=activity`}>{name(e.clientId)}</Link> : <span className="text-[var(--text-muted)]">Studio</span>}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{e.area}</TableCell>
                    <TableCell className="text-sm">{e.text}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </>
  )
}

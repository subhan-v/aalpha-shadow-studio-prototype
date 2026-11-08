"use client"

// Platform (audit 3.4): the things that are not about one client.

import { useState } from "react"
import { Kpi, PageHeader, Pill, Segmented, Section } from "@/components/bits"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { addDays, fmt, hash } from "@/lib/dates"
import { installed, silent } from "@/lib/engine"
import { useStore } from "@/lib/store"
import { canMoney } from "@/lib/access"
import { cost30 } from "@/lib/finance"
import { APP } from "@/lib/flags"

const TABS = [{ id: "users", label: "Users" }, { id: "ai", label: "AI usage" }, { id: "mcp", label: "MCP keys" }, { id: "releases", label: "Releases" }, { id: "blog", label: "Blog" }]

export default function Platform() {
  const { s } = useStore()
  const [tab, setTab] = useState("users")
  const t = s.today
  const users = s.clients.flatMap((c) => c.seats.map((x) => ({ c, x, st: !installed(x, t) ? "Invited" : silent(x, t) ? "No data today" : "Recording" })))
  const ai = s.clients.reduce((n, c) => n + cost30(s, c).ai, 0)
  const models: [string, string, number, number][] = [["Vision model", "Screen analysis", 0.61, 412], ["Text model", "Text and OCR summaries", 0.18, 188], ["Text model", "Slack analysis", 0.14, 96], ["Large model", "Reports and SOP drafts", 0.07, 11]]

  return (
    <>
      <PageHeader title="Platform" sub="Everything that is not about one client." right={<Segmented label="Platform" value={tab} onChange={setTab} options={TABS} />} />

      {tab === "users" && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            <Kpi label="Client users" value={users.length} />
            <Kpi label="Recording" value={users.filter((u) => u.st === "Recording").length} />
            <Kpi label="Invited, not installed" value={users.filter((u) => u.st === "Invited").length} />
            <Kpi label="Aalpha team" value={s.team.length} note="Managed in Settings" />
          </div>
          <Section title="Client users" sub="Across every organization">
            <div className="max-h-[520px] overflow-auto">
              <Table className="min-w-[640px]">
                <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Organization</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map(({ c, x, st }) => (
                    <TableRow key={x.id}><TableCell className="font-medium">{x.name}</TableCell><TableCell>{c.name}</TableCell><TableCell className="text-[var(--text-secondary)]">{x.role}</TableCell><TableCell><Pill t={st === "Recording" ? "good" : st === "Invited" ? "muted" : "warn"}>{st}</Pill></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Section>
        </>
      )}

      {tab === "ai" && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            {canMoney(s) && <Kpi label="AI cost, 30 days" value={`$${ai.toLocaleString()}`} />}
            <Kpi label="Tokens, 30 days" value={`${Math.round(ai * 0.42).toLocaleString()}M`} note="input and output" />
            <Kpi label="Prompt cache hits" value="38%" note="share of input tokens served from cache" />
          </div>
          <Section title="By model and step" sub="Model names stay here, never in client copy">
            <Table>
              <TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Used for</TableHead><TableHead className="text-right">Requests</TableHead>{canMoney(s) && <TableHead className="text-right">Cost</TableHead>}</TableRow></TableHeader>
              <TableBody>{models.map(([m, u, p, r]) => <TableRow key={u}><TableCell className="font-medium">{m}</TableCell><TableCell className="text-[var(--text-secondary)]">{u}</TableCell><TableCell className="text-right tabular-nums">{(r * 1000).toLocaleString()}</TableCell>{canMoney(s) && <TableCell className="text-right tabular-nums">${Math.round(ai * p).toLocaleString()}</TableCell>}</TableRow>)}</TableBody>
            </Table>
          </Section>
        </>
      )}

      {tab === "mcp" && (
        <Section title="MCP keys" sub={`Read-only keys for the ${APP} MCP. Values are never shown again after creation.`}>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Scope</TableHead><TableHead>Key</TableHead><TableHead>Last used</TableHead></TableRow></TableHeader>
            <TableBody>
              {[["Studio admin", "All organizations, read only"], ["Delivery agent", "Assigned clients, read only"], ["Reporting job", "All organizations, read only"]].map(([n, sc], i) => (
                <TableRow key={n}><TableCell className="font-medium">{n}</TableCell><TableCell className="text-[var(--text-secondary)]">{sc}</TableCell><TableCell className="font-mono text-xs">shd_••••{Math.round(hash(n) * 9000 + 1000)}</TableCell><TableCell className="font-mono text-xs">{fmt(addDays(t, -i))}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      {tab === "releases" && (
        <Section title="Releases" sub="Desktop app and web, newest first">
          {[["0.9.14", "Desktop", "Faster uploads on slow networks", 2], ["0.9.13", "Desktop", "Pause from the menu bar", 9], ["Web 2026.10.3", "Web", "View as client in Studio", 12], ["0.9.12", "Desktop", "Privacy list synced from Studio", 20]].map(([v, k, d, ago]) => (
            <div key={String(v)} className="grid grid-cols-[120px_80px_minmax(0,1fr)_80px] items-center gap-3 border-t py-2.5 text-sm first:border-t-0"><span className="font-mono text-xs">{v}</span><Pill t="muted">{k}</Pill><span>{d}</span><span className="text-right font-mono text-xs text-[var(--text-muted)]">{fmt(addDays(t, -Number(ago)))}</span></div>
          ))}
        </Section>
      )}

      {tab === "blog" && (
        <Section title="Blog" sub="Posts on the public site">
          {[["How agencies lose a hire's worth of hours to status updates", "Published", 6], ["What 14 days of real work data shows an agency owner", "Draft", 1]].map(([title, st, ago]) => (
            <div key={String(title)} className="flex flex-wrap items-center justify-between gap-3 border-t py-2.5 text-sm first:border-t-0"><span className="font-medium">{title}</span><span className="flex items-center gap-3"><Pill t={st === "Published" ? "good" : "muted"}>{st}</Pill><span className="font-mono text-xs text-[var(--text-muted)]">{fmt(addDays(t, -Number(ago)))}</span></span></div>
          ))}
        </Section>
      )}
    </>
  )
}

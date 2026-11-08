// The audit trail: every change in Studio, with who made it and their access. Entries are worked
// out by comparing the state before and after a change, so no screen has to remember to log.

import { accessOf, UNTRACKED } from "./access"
import type { AuditEntry, Client, State } from "./types"

type Draft = Omit<AuditEntry, "id" | "at" | "time" | "by" | "access">

const LABEL: Partial<Record<keyof State, string>> = {
  acks: "Snoozed an alert", done: "Marked an action done", assign: "Reassigned an action", sequence: "Edited the onboarding message ladder",
  autopilot: "Turned onboarding autopilot on or off", sends: "Sent onboarding messages", slack: "Handled a Slack message",
  interviewSets: "Edited interview questions", bugs: "Updated a bug", pricing: "Changed list prices", stripe: "Changed the Stripe connection", sender: "Changed who onboarding messages come from",
}

// Plain names for client fields, so a change reads "Changed recording hours", not "Changed schedules".
const FIELD: Partial<Record<keyof Client, string>> = {
  prefs: "personal settings", seats: "people", goals: "goals", schedules: "recording hours", capture: "what is recorded",
  agents: "agents", workflows: "workflows", sops: "the Playbook", fit: "the Fit Map", reports: "reports", connections: "connections",
  business: "the business profile", pay: "payroll rates", staff: "who works on the client", owner: "the owner", pauses: "the clock",
}

/** Log lines a change added to the top of a client's log. */
function newLines(before: Client, after: Client) {
  const k = after.log.length - before.log.length
  if (k <= 0 || (before.log.length && after.log[k] !== before.log[0])) return []
  return after.log.slice(0, k)
}

export function auditDiff(p: State, n: State): Draft[] {
  const out: Draft[] = []
  for (const c of n.clients) {
    const b = p.clients.find((x) => x.id === c.id)
    if (!b) { out.push({ clientId: c.id, area: "Clients", text: `Added client ${c.name}` }); continue }
    if (b === c) continue
    const lines = newLines(b, c)
    if (lines.length) lines.forEach((l) => out.push({ clientId: c.id, area: "Client", text: l.text }))
    else {
      const fields = (Object.keys(c) as (keyof Client)[]).filter((f) => f !== "log" && b[f] !== c[f])
      if (fields.length) out.push({ clientId: c.id, area: "Client", text: `Changed ${Array.from(new Set(fields.map((f) => FIELD[f] ?? String(f)))).join(", ")}` })
    }
  }
  for (const b of p.clients) if (!n.clients.some((c) => c.id === b.id)) out.push({ clientId: b.id, area: "Clients", text: `Removed client ${b.name}` })

  if (p.requests !== n.requests) for (const r of n.requests) {
    const b = p.requests.find((x) => x.id === r.id)
    if (!b) out.push({ clientId: r.clientId, area: "Requests", text: `New request: ${r.title}` })
    else if (b.status !== r.status) out.push({ clientId: r.clientId, area: "Requests", text: `${r.title}: ${b.status} to ${r.status}` })
    else if (!b.linear && r.linear) out.push({ clientId: r.clientId, area: "Requests", text: `Sent to Linear: ${r.title}` })
    else if (b !== r) out.push({ clientId: r.clientId, area: "Requests", text: `Updated request: ${r.title}` })
  }
  if (p.team !== n.team) {
    for (const m of n.team) {
      const b = p.team.find((x) => x.id === m.id)
      if (!b) out.push({ clientId: null, area: "Team", text: `Added ${m.name} as ${m.access ?? "Viewer"}` })
      else if (b.access !== m.access) out.push({ clientId: null, area: "Team", text: `${m.name}: ${b.access ?? "Viewer"} to ${m.access ?? "Viewer"}` })
    }
    for (const b of p.team) if (!n.team.some((m) => m.id === b.id)) out.push({ clientId: null, area: "Team", text: `Removed ${b.name}` })
  }
  if (p.settings !== n.settings) for (const k of Object.keys(n.settings) as (keyof State["settings"])[]) {
    if (p.settings[k] !== n.settings[k]) out.push({ clientId: null, area: "Settings", text: `Alert rule ${k}: ${p.settings[k]} to ${n.settings[k]}` })
  }
  // Anything else that changed, once per area. A client log line already covers its own sends.
  for (const k of Object.keys(LABEL) as (keyof State)[]) {
    if (UNTRACKED.includes(k) || p[k] === n[k]) continue
    if (k === "sends" && out.some((x) => x.area === "Client")) continue
    if (k === "done" && out.some((x) => x.area === "Client")) continue
    out.push({ clientId: null, area: "Studio", text: LABEL[k]! })
  }
  return out
}

/** The next state with this change's audit entries added. */
export function withAudit(p: State, n: State, time: string, via: string | null = null): State {
  if (p === n) return n
  const drafts = auditDiff(p, n)
  if (!drafts.length) return n
  const by = p.me, access = accessOf(p)
  const entries: AuditEntry[] = drafts.map((d, i) => ({ ...d, id: `au${Date.now()}${i}`, at: p.today, time, by, access, via }))
  return { ...n, audit: [...entries, ...(n.audit ?? [])].slice(0, 2000) }
}

// Who on the Aalpha team can do what in Studio. Admins do everything. Specialists run delivery
// but never see or change the business side: revenue, margins, subscriptions, contracts, churn.
// AI running costs are Admin-only too; Specialists still get cost-spike alerts, as a multiple, not dollars.
// Viewers can look around everything a Specialist sees and change nothing.
// Specialists and Viewers only see the clients they own or are assigned to; Admins see all.

import type { Access, Client, State } from "./types"

export const ACCESS: { id: Access; does: string }[] = [
  { id: "Admin", does: "Everything, including billing, prices, the team and settings" },
  { id: "Specialist", does: "Runs the clients they own or are on. No revenue, margins, billing or AI costs" },
  { id: "Viewer", does: "Sees the clients they are on. Can't change anything" },
]

export const accessOf = (s: State): Access => s.team.find((m) => m.name === s.me)?.access ?? "Viewer"
export const canEdit = (s: State) => accessOf(s) !== "Viewer"
export const canMoney = (s: State) => accessOf(s) === "Admin"
/** Pages and cockpit tabs about the business side of a client, for Admins only. */
export const MONEY_PAGES = ["/revenue", "/costs", "/retention"]
export const MONEY_TABS = ["health", "costs", "subscription"]

// Fields on a client that only an Admin may change.
const MONEY_FIELDS: (keyof Client)[] = ["price", "sub", "contract", "consentVersion", "plan", "agreementSigned", "paymentIn"]
// Who works a client: only an Admin moves people on or off.
const ASSIGN_FIELDS: (keyof Client)[] = ["owner", "staff"]
// Studio-wide settings that only an Admin may change.
const ADMIN_KEYS: (keyof State)[] = ["pricing", "stripe", "team", "settings", "sender"]
// Demo controls and bookkeeping that anyone may change and nobody needs to audit.
export const UNTRACKED: (keyof State)[] = ["today", "sim", "viewLog", "me", "audit", "version", "linearSeq"]

/** Is this client one the person works on? Admins work on all of them. */
export const onClient = (s: State, c: Client) => accessOf(s) === "Admin" || c.owner === s.me || !!c.staff?.includes(s.me)

/** The state as the signed-in person may see it: only their clients, and the requests, messages
 *  and audit lines that belong to them. Writes still go to the full state. */
export function scopeState(s: State): State {
  if (accessOf(s) === "Admin") return s
  const ids = new Set(s.clients.filter((c) => onClient(s, c)).map((c) => c.id))
  const mine = (id: string | null) => id === null || ids.has(id)
  return {
    ...s,
    clients: s.clients.filter((c) => ids.has(c.id)),
    requests: s.requests.filter((r) => mine(r.clientId)),
    sends: s.sends.filter((x) => ids.has(x.clientId)),
    viewLog: s.viewLog.filter((v) => ids.has(v.clientId)),
    audit: (s.audit ?? []).filter((e) => mine(e.clientId)),
    bugs: (s.bugs ?? []).filter((b) => mine(b.clientId)),
  }
}

/** Why a change isn't allowed for the signed-in person, or null when it is. */
export function denied(p: State, n: State): string | null {
  if (p === n) return null
  const who = accessOf(p)
  if (who === "Admin") return null
  const changed = (Object.keys(n) as (keyof State)[]).filter((k) => !UNTRACKED.includes(k) && p[k] !== n[k])
  if (!changed.length) return null
  if (who === "Viewer") return "You have view-only access, so changes are turned off."
  if (changed.some((k) => ADMIN_KEYS.includes(k))) return "Only an Admin can change prices, the team or Studio settings."
  if (n.clients.length !== p.clients.length) return "Only an Admin can add or remove clients."
  const notMine = n.clients.some((c) => {
    const before = p.clients.find((x) => x.id === c.id)
    return before && before !== c && !onClient(p, before)
  }) || n.requests.some((r) => {
    const before = p.requests.find((x) => x.id === r.id)
    const c = p.clients.find((x) => x.id === r.clientId)
    return before !== r && !!c && !onClient(p, c)
  })
  if (notMine) return "That client isn't assigned to you."
  const moved = n.clients.some((c) => {
    const before = p.clients.find((x) => x.id === c.id)
    return before && ASSIGN_FIELDS.some((f) => before[f] !== c[f])
  })
  if (moved) return "Only an Admin can change who works on a client."
  // Specialists move a renewal along (open it, send the proposal, offboard); only Admins decide it or price it.
  const decided = n.clients.some((c) => {
    const b = p.clients.find((x) => x.id === c.id)?.renewal, r = c.renewal
    if (!b || b === r || !r) return false
    return r.stage !== b.stage && (r.stage === "Renewed" || r.stage === "Lost" || b.stage === "Renewed" || b.stage === "Lost") || r.price !== b.price || (r.proposedPrice ?? null) !== (b.proposedPrice ?? null)
  })
  if (decided) return "Only an Admin can record a renewal outcome or its price."
  const moneyTouched = n.clients.some((c) => {
    const before = p.clients.find((x) => x.id === c.id)
    return before && MONEY_FIELDS.some((f) => before[f] !== c[f])
  })
  return moneyTouched ? "Only an Admin can change billing, prices or contracts." : null
}

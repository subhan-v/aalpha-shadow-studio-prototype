// Teams. By default an agency is organized by function, and each person has one home team so
// hours are never counted twice. Agencies that run on pods use pods as home teams instead, and
// every person still carries a function so work can be seen "by function across pods". Hybrid
// puts client delivery in pods and keeps shared services as function teams. Teams under 3
// people are never shown on their own: they roll up so no one person is exposed.

import { hash } from "./dates"
import { ROLE_CATS } from "./roles"
import type { Category, Client, Role, Seat, Workflow } from "./types"

export const MIN_TEAM = 3
export const FUNCTIONS = ["Client delivery", "Paid media", "SEO and web", "Creative", "Sales", "Ops and finance"] as const
export const SHARED = ["Creative", "Sales", "Ops and finance"] // stay function teams in a hybrid agency

const ROLE_FN: Record<string, string> = {
  "Account manager": "Client delivery", "Account director": "Client delivery", CSM: "Client delivery",
  "Media buyer": "Paid media", "PPC analyst": "Paid media", "Ads manager": "Paid media",
  "SEO specialist": "SEO and web", "Content writer": "SEO and web",
  Designer: "Creative", "Video editor": "Creative",
  "Sales lead": "Sales", CEO: "Sales", COO: "Ops and finance", Ops: "Ops and finance",
}
export const CAT_FN: Record<Category, string> = { Reporting: "Client delivery", "Client delivery": "Client delivery", "Paid media": "Paid media", Creative: "Creative", "Ops and admin": "Ops and finance", Sales: "Sales" }

/** Suggested from the job title; the owner confirms it at kickoff. */
export const suggestFunction = (role: string) => ROLE_FN[role] ?? "Ops and finance"
export const funcOf = (s: Seat) => s.team ?? suggestFunction(s.role)
export const orgOf = (c: Client) => c.org ?? "function"

/** The one team a person's hours count toward. */
export function homeTeam(c: Client, s: Seat) {
  const org = orgOf(c)
  if (org === "function" || !s.pod) return funcOf(s)
  if (org === "hybrid" && SHARED.includes(funcOf(s))) return funcOf(s)
  return s.pod
}

export type Team = { name: string; kind: "function" | "pod"; lead: Seat | null; seats: Seat[] }

export function teamsOf(c: Client): Team[] {
  const names = Array.from(new Set(c.seats.map((s) => homeTeam(c, s))))
  return names.map((name) => {
    const seats = c.seats.filter((s) => homeTeam(c, s) === name)
    const pod = c.pods?.find((p) => p.name === name)
    const leadId = pod ? pod.lead : c.funcHeads?.[name]
    const lead = c.seats.find((s) => s.id === leadId) ?? seats.find((s) => !c.fit.find((f) => f.seatId === s.id)?.reportsTo) ?? seats[0] ?? null
    return { name, kind: pod ? ("pod" as const) : ("function" as const), lead, seats }
  }).sort((a, b) => b.seats.length - a.seats.length)
}

/** What a person may see. Owners see every team. Managers see their home team, any team they
 *  lead, extra teams granted to them, and, as a function head, their function across pods. */
export function scopeFor(c: Client, role: Role | "Admin", me: Seat): { teams: string[]; fn: string | null } {
  const all = teamsOf(c)
  if (role === "Owner" || role === "Admin") return { teams: all.map((t) => t.name), fn: null }
  if (role === "Member") return { teams: [homeTeam(c, me)], fn: null }
  const fn = Object.entries(c.funcHeads ?? {}).find(([, id]) => id === me.id)?.[0] ?? null
  const led = all.filter((t) => t.lead?.id === me.id).map((t) => t.name)
  return { teams: Array.from(new Set([homeTeam(c, me), ...led, ...(c.viewTeams?.[me.id] ?? [])])), fn: orgOf(c) === "function" ? null : fn }
}

/** People a viewer may see: their teams, plus their function across pods for a function head. */
export function seatsInScope(c: Client, role: Role | "Admin", me: Seat) {
  const sc = scopeFor(c, role, me)
  return c.seats.filter((s) => sc.teams.includes(homeTeam(c, s)) || (sc.fn !== null && funcOf(s) === sc.fn))
}

/** Teams big enough to show on their own, and the rest rolled up into one line. */
export function displayTeams(list: Team[]) {
  const big = list.filter((t) => t.seats.length >= MIN_TEAM)
  const small = list.filter((t) => t.seats.length < MIN_TEAM)
  const rolled = small.reduce((n, t) => n + t.seats.length, 0)
  return { big, small, rolled: rolled ? { name: small.length === 1 ? "Smaller team" : `${small.length} smaller teams`, seats: small.flatMap((t) => t.seats) } : null }
}

/** A workflow's share in one team: by function it is that function's work, by pod it is the pod's share of the people who do it. */
export function teamShare(c: Client, w: Workflow, team: string) {
  // A team's share of a workflow is its share of the people whose role does that kind of work.
  const doers = c.seats.filter((s) => (ROLE_CATS[s.role] ?? []).includes(w.category))
  if (!doers.length) return CAT_FN[w.category] === team ? 1 : 0
  // A function name in a pod agency means "this function across every pod".
  const isPod = c.pods?.some((p) => p.name === team)
  const inTeam = (s: Seat) => (!isPod && orgOf(c) !== "function" ? funcOf(s) === team : homeTeam(c, s) === team)
  return doers.filter(inTeam).length / doers.length
}

/** Average minutes a run in each pod: the fastest pod's way is the candidate for the Playbook. */
export function podTimes(c: Client, w: Workflow) {
  if (orgOf(c) === "function" || !c.pods?.length) return []
  if (orgOf(c) === "hybrid" && SHARED.includes(CAT_FN[w.category])) return []
  // Pods under 3 people are left out, so no single person's speed is shown.
  return c.pods.filter((p) => c.seats.filter((s) => s.pod === p.name).length >= MIN_TEAM).map((p) => ({ pod: p.name, mins: Math.max(2, Math.round(w.avgMin * (0.55 + hash(p.name + w.id) * 0.9))) })).sort((a, b) => a.mins - b.mins)
}

export const clientTags = (c: Client) => Array.from(new Set(c.workflows.flatMap((w) => w.clients ?? []))).sort()

/** The client as a manager sees it: only the people in their scope, and each workflow cut to the
 *  share of its doers who sit in those teams. Every Overview number then comes out team-level. */
export function scopedView(c: Client, seats: Seat[]): Client {
  const ids = new Set(seats.map((s) => s.id))
  const teams = new Set(seats.map((s) => homeTeam(c, s)))
  const share = (w: Workflow) => {
    const doers = c.seats.filter((s) => (ROLE_CATS[s.role] ?? []).includes(w.category))
    if (!doers.length) return teams.has(CAT_FN[w.category]) ? 1 : 0
    return doers.filter((s) => ids.has(s.id)).length / doers.length
  }
  const workflows = c.workflows.flatMap((w) => {
    const k = share(w)
    // Interview hand-offs count only the people in scope, by name.
    const names = new Set(seats.map((s) => s.name))
    return k > 0 ? [{ ...w, hoursWk: Math.round(w.hoursWk * k * 10) / 10, runs: Math.round(w.runs * k), handoffBy: w.handoffBy?.filter((n) => names.has(n)) }] : []
  })
  return { ...c, seats: c.seats.filter((s) => ids.has(s.id)), workflows }
}

/** How a manager's scope reads in a sentence: "Paid media", "Paid media and Creative", or with a function across pods. */
export function scopeLabel(c: Client, role: Role | "Admin", me: Seat) {
  const sc = scopeFor(c, role, me)
  const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)
  return `${list(sc.teams)}${sc.fn ? `, plus ${sc.fn} across pods` : ""}`
}

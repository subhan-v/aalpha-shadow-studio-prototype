// Goals the client can lock. Owners and managers edit them as a draft, then lock them in.
// A locked goal is read-only: changing it takes a request that Aalpha approves in Studio,
// which unlocks the goals again. Locked goals tune the rankings across the client app.

import { valueMo } from "./client-data"
import { newRequest, patchRequest } from "./requests"
import type { Category, Client, Goal, GoalPriority, ISODate, State, Workflow } from "./types"

export type GoalState = "draft" | "locked" | "pending"

export function goalState(c: Client): GoalState {
  if (!c.goalLock?.locked) return "draft"
  return c.goalLock.pending ? "pending" : "locked"
}

/** What the client sees: goals Aalpha has published, plus any the client added. */
export const clientGoals = (c: Client) => c.goals.filter((g) => g.status === "published" && (g.level ?? "company") === "company")
export const teamGoals = (c: Client, team?: string) => c.goals.filter((g) => g.level === "team" && (!team || g.team === team))
export const personalGoals = (c: Client, seatId?: string) => c.goals.filter((g) => g.level === "personal" && (!seatId || g.ownerId === seatId))
/** Goals someone else may see: a private wellbeing goal stays with its owner. */
export const visiblePersonal = (g: Goal, viewerId: string) => g.ownerId === viewerId || !g.wellbeing || !!g.shared
/** Personal goals are about time back, not output. */
export const looksLikeQuota = (t: string) => /\b(sell|sales of|close|closed|deals?|quota|revenue|output|units|calls a day|leads a)\b/i.test(t)

const WEIGHT: Record<GoalPriority, number> = { High: 3, Medium: 2, Low: 1 }

/** Each category a goal covers, with the strongest priority that covers it and the goals behind it. */
export function goalFocus(c: Client) {
  const out = new Map<Category, { weight: number; goals: Goal[] }>()
  for (const g of clientGoals(c)) {
    for (const k of g.categories) {
      const cur = out.get(k) ?? { weight: 0, goals: [] }
      // Narrowest goal first: it says most about why this work matters.
      out.set(k, { weight: Math.max(cur.weight, WEIGHT[g.priority ?? "Medium"]), goals: [...cur.goals, g].sort((a, b) => a.categories.length - b.categories.length) })
    }
  }
  return out
}

/** Value a month, lifted for work that serves a goal (a High goal counts 2x, Medium 1.7x, Low 1.35x). */
export function tunedScore(c: Client, w: Workflow, focus = goalFocus(c)) {
  return valueMo(c, w.hoursWk, w.category) * (1 + 0.35 * (focus.get(w.category)?.weight ?? 0))
}

export function tuned<T extends Workflow>(c: Client, list: T[]): T[] {
  const focus = goalFocus(c)
  return [...list].sort((a, b) => tunedScore(c, b, focus) - tunedScore(c, a, focus))
}

const setClient = (s: State, id: string, fn: (c: Client, t: ISODate) => Client): State => ({ ...s, clients: s.clients.map((c) => (c.id === id ? fn(c, s.today) : c)) })

export function lockGoals(s: State, clientId: string, who: string): State {
  return setClient(s, clientId, (c, t) => ({ ...c, goalLock: { locked: true, by: who, at: t, pending: null }, log: [{ date: t, text: `Goals locked by ${who}.` }, ...c.log] }))
}

export function requestGoalChange(s: State, clientId: string, who: string, note: string): State {
  const c = s.clients.find((x) => x.id === clientId)
  if (!c) return s
  const next = newRequest(s, {
    clientId, from: `${who} (${c.name})`, source: "Client app", kind: "Change", title: "Change our locked goals",
    detail: note || "No details given.", priority: "High", assignee: c.owner, action: "unlock-goals",
  })
  const reqId = next.requests[0].id
  return setClient(next, clientId, (x, t) => ({ ...x, goalLock: { ...(x.goalLock ?? { locked: true, by: who, at: t }), pending: reqId }, log: [{ date: t, text: `${who} asked to change the locked goals.` }, ...x.log] }))
}

/** Aalpha's decision on a goal change. Approving unlocks the goals so the client can edit and lock again. */
export function decideGoalChange(s: State, requestId: string, approve: boolean): State {
  const r = s.requests.find((x) => x.id === requestId)
  if (!r?.clientId) return s
  const next = patchRequest(s, requestId, { status: approve ? "Done" : "Declined" }, approve ? "Approved. Your goals are unlocked so you can edit them and lock them again." : "Declined. Your goals stay as they are. We'll explain why in Slack.")
  return setClient(next, r.clientId, (c, t) => ({
    ...c,
    goalLock: approve ? { locked: false, by: null, at: null, pending: null } : { ...(c.goalLock ?? { locked: true, by: null, at: null }), pending: null },
    log: [{ date: t, text: approve ? `Goal change approved by ${s.me}. Goals unlocked.` : `Goal change declined by ${s.me}. Goals stay locked.` }, ...c.log],
  }))
}

// Requests: one inbox for everything coming in. Anything for the dev team is pushed to
// Linear from here (simulated in the prototype; the real build uses the Linear API).

import { bugFromRequest } from "./bugs"
import type { ISODate, Request, State } from "./types"

export const OPEN: Request["status"][] = ["New", "In progress", "Waiting on approval"]
/** Still needs someone: an open status, or a Linear ticket the dev team hasn't closed. One rule for the list, the KPI and the nav badge. */
export const isOpen = (r: Request) => OPEN.includes(r.status) || (!!r.linear && r.linear.state !== "Done" && r.status !== "Declined")

export function newRequest(s: State, r: Omit<Request, "id" | "created" | "status" | "thread" | "linear"> & { status?: Request["status"] }): State {
  const req: Request = { ...r, id: `r${Date.now()}`, created: s.today, status: r.status ?? (r.kind === "Data deletion" ? "In progress" : "New"), thread: [], linear: null }
  const next = { ...s, requests: [req, ...s.requests] }
  // Anything reported as broken is also tracked as a bug, linked to this request.
  return r.kind === "Bug" ? bugFromRequest(next, req) : next
}

export function patchRequest(s: State, id: string, patch: Partial<Request>, note?: string): State {
  return {
    ...s,
    requests: s.requests.map((r) => (r.id === id ? { ...r, ...patch, thread: note ? [...r.thread, { at: s.today, who: s.me, text: note }] : r.thread } : r)),
  }
}

export function sendToLinear(s: State, id: string): State {
  const key = `SHA-${s.linearSeq + 1}`
  const next = patchRequest(s, id, { status: "Sent to Linear", linear: { id: key, state: "Todo" } }, `Sent to the dev team as ${key}.`)
  return { ...next, linearSeq: s.linearSeq + 1 }
}

/** Simulates Linear moving a ticket along; in the real build this is a webhook. */
export function syncLinear(s: State, id: string): State {
  const r = s.requests.find((x) => x.id === id)
  if (!r?.linear) return s
  const nextState = r.linear.state === "Todo" ? "In progress" : "Done"
  return patchRequest(s, id, { linear: { ...r.linear, state: nextState }, status: nextState === "Done" ? "Done" : r.status }, `Linear ${r.linear.id} moved to ${nextState}.`)
}

/** A deletion request is carried out, never declined. Marking it done records it on the client. */
export function completeDeletion(s: State, id: string): State {
  const r = s.requests.find((x) => x.id === id)
  if (!r) return s
  const what = r.scope === "company" ? "All of the company's data was deleted." : r.scope === "person" ? "Everything we held for them was deleted." : "The data for that day was deleted."
  const next = patchRequest(s, id, { status: "Done" }, `Done. ${what}`)
  if (!r.clientId) return next
  return { ...next, clients: next.clients.map((c) => (c.id === r.clientId ? { ...c, dataDeletedAt: r.scope === "company" ? s.today : c.dataDeletedAt, log: [{ date: s.today, text: `Data deleted on request: ${r.title}.` }, ...c.log] } : c)) }
}

export function ageDays(created: ISODate, today: ISODate) {
  return Math.round((new Date(today).getTime() - new Date(created).getTime()) / 86_400_000)
}

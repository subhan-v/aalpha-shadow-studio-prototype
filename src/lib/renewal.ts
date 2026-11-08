// The renewal at day 90. The 90 days end on their own; the monthly plan does not start on its own.
// A renewal opens at day 75, a proposal goes out, and someone records the outcome: renewed at an
// agreed price from a start date, or lost with a reason. Until then, nothing bills after day 90
// and the client shows as a renewal decision overdue. A lost client is offboarded and leaves the
// day-to-day lists, but stays in Retention so churn is counted from real outcomes.

import { addDays, diffDays } from "./dates"
import { dateOfDay, dayN } from "./engine"
import type { ChurnReason, Client, ISODate, Renewal } from "./types"

export const CHURN_REASONS: ChurnReason[] = ["Didn't see enough value", "Price", "Budget cut", "Doing it in-house", "Champion left", "Went with someone else", "Other"]

/** The onboarding term. Every "after the 90 days" check goes through past90, so the boundary lives here. */
export const TERM = 90
/** True from day 91: the 90 days are over, whatever happened at renewal. */
export const past90 = (c: Client, on: ISODate) => (dayN(c, on) ?? 0) > TERM

export type Phase = "not started" | "onboarding" | "recurring" | "awaiting renewal" | "ended"

/** First day after the 90 days, counting pauses. */
export const day91 = (c: Client): ISODate | null => dateOfDay(c, TERM + 1)

/** Where the renewal is today, including the stages nobody has recorded yet. */
export function renewalStage(c: Client, today: ISODate): Renewal["stage"] | "Not open" | "Due to open" {
  if (c.renewal) return c.renewal.stage
  const n = dayN(c, today)
  return n !== null && n >= 75 ? "Due to open" : "Not open"
}

/** What a client is on for billing on a given day. */
export function phase(c: Client, on: ISODate): Phase {
  const n = dayN(c, on)
  if (n === null) return "not started"
  // A cancellation ends the client on its date, whenever that falls.
  if (c.sub?.cancelAt && c.sub.cancelAt <= on) return "ended"
  if (n <= TERM) return "onboarding"
  const r = c.renewal
  if (r?.stage === "Renewed") return r.startsOn && on < r.startsOn ? "awaiting renewal" : "recurring"
  if (r?.stage === "Lost") return "ended"
  return "awaiting renewal"
}

/** Days past day 90 with no decision; 0 when decided or not there yet. */
export function overdueDays(c: Client, today: ISODate) {
  const d = day91(c)
  if (!d || today < d || c.renewal?.stage === "Renewed" || c.renewal?.stage === "Lost") return 0
  return diffDays(today, d) + 1
}

/** A client who left, by a lost renewal or a cancellation, past their last day: off every day-to-day list. */
export const churned = (c: Client, today: ISODate) => phase(c, today) === "ended"

/** How a client left, read the same way for both routes so churn is counted and explained once. */
export type Churn = { how: "Lost at renewal" | "Cancelled"; at: ISODate; reason: ChurnReason; note: string | null }
export function churnOf(c: Client, today: ISODate): Churn | null {
  if (c.renewal?.stage === "Lost" && c.renewal.decidedAt) return { how: "Lost at renewal", at: c.renewal.decidedAt, reason: c.renewal.reason ?? "Other", note: c.renewal.note ?? null }
  if (c.sub?.cancelAt && c.sub.cancelAt <= today) return { how: "Cancelled", at: c.sub.cancelAt, reason: c.sub.cancelReason ?? "Other", note: c.sub.cancelNote ?? null }
  return null
}

/** Months on the monthly plan so far, counted from its start. */
export function recurringMonth(c: Client, today: ISODate) {
  const start = c.renewal?.startsOn ?? day91(c)
  return start && today >= start ? Math.floor(diffDays(today, start) / 30) + 1 : 0
}

// ── changes (each one leaves a line in the client's log) ───────────────────

const log = (c: Client, today: ISODate, text: string): Client => ({ ...c, log: [{ date: today, text }, ...c.log] })

export const openRenewal = (c: Client, today: ISODate, by: string): Client =>
  log({ ...c, renewalOpened: true, renewal: { stage: "Open", openedAt: today } }, today, `Renewal opened by ${by}.`)

export const sendProposal = (c: Client, today: ISODate, by: string, price: number | null): Client =>
  log({ ...c, renewalOpened: true, renewal: { ...(c.renewal ?? { openedAt: today }), stage: "Proposal sent", proposedAt: today, proposedPrice: price } }, today, `Renewal proposal sent by ${by}${price ? ` at $${price.toLocaleString()} a month` : ""}.`)

/** Renewed: the monthly plan starts the day after day 90, or today if the decision came later. */
export function renew(c: Client, today: ISODate, by: string, price: number): Client {
  const d = day91(c) ?? today
  const startsOn = today > d ? today : d
  return log({ ...c, price, renewal: { ...(c.renewal ?? { openedAt: today }), stage: "Renewed", decidedAt: today, decidedBy: by, price, startsOn } }, today, `Renewed by ${by} at $${price.toLocaleString()} a month, starting ${startsOn}.`)
}

export const lose = (c: Client, today: ISODate, by: string, reason: ChurnReason, note: string): Client =>
  log({ ...c, renewal: { ...(c.renewal ?? { openedAt: today }), stage: "Lost", decidedAt: today, decidedBy: by, reason, note: note || null } }, today, `Renewal lost (${by}): ${reason}${note ? `. ${note}` : ""}.`)

export const reopen = (c: Client, today: ISODate, by: string): Client =>
  log({ ...c, renewal: { stage: "Open", openedAt: c.renewal?.openedAt ?? today } }, today, `Renewal reopened by ${by}.`)

export const offboard = (c: Client, today: ISODate): Client =>
  log({ ...c, offboardedAt: today, seats: c.seats.map((x) => ({ ...x, away: "excluded" as const })) }, today, "Offboarded: Shadow removed from every computer and the data deletion scheduled.")

/** Sample renewal for a client already past day 90 when the prototype starts. */
export const sampleRenewed = (c: Client, price: number): Renewal => {
  const d = day91(c)!
  return { stage: "Renewed", openedAt: addDays(d, -16), proposedAt: addDays(d, -9), proposedPrice: price, decidedAt: addDays(d, -3), decidedBy: c.owner, price, startsOn: d }
}

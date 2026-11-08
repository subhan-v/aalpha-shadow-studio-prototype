// Client health and churn risk (Studio only). After day 90 a client is on the recurring plan
// with monthly deliverables; health is scored from value, engagement, delivery, money and
// people signals, with the top reasons named. Clients never see a risk score.

import { addDays, diffDays, fmt, hash } from "./dates"
import { agentHealth } from "./agent-health"
import { billing, listFor, revenueMo } from "./finance"
import { agentStatus, dayN, guarantees, hoursBack, risk } from "./engine"
import { captured } from "./recording"
import { sentiment } from "./slack"
import { churnOf, day91, overdueDays, past90, phase, recurringMonth, renewalStage } from "./renewal"
import type { Client, ISODate, State } from "./types"

// ── recurring deliverables ──────────────────────────────────────────────────

export type Deliverable = { name: string; due: ISODate; status: "Done" | "Late" | "Missed" | "Due" }

/** Each month after day 90: new agents, upkeep, a scorecard, a review call; a re-measure every quarter. */
export function recurringMonths(c: Client, today: ISODate) {
  // Deliverables only run once the renewal is recorded, from the plan's first day.
  const months = phase(c, today) === "recurring" ? recurringMonth(c, today) : 0
  const first = c.renewal?.startsOn ?? day91(c)
  if (!months || !first) return []
  return Array.from({ length: months }, (_, m) => {
    const start = addDays(first, 30 * m)
    const end = addDays(start, 30)
    const base: Deliverable[] = [
      { name: "2 new agents built", due: addDays(start, 25), status: "Done" },
      { name: "Agent upkeep: every agent above 90% success", due: end, status: "Done" },
      { name: "Monthly scorecard", due: addDays(start, 5), status: "Done" },
      { name: "Monthly review call", due: addDays(start, 10), status: "Done" },
      ...(m % 3 === 2 ? [{ name: "Quarterly re-measure (two weeks recording)", due: addDays(start, 20), status: "Done" as const }] : []),
    ]
    const items: Deliverable[] = base.map((d) => {
      if (d.due > today) return { ...d, status: "Due" as const }
      if (c.deliveryLate?.includes(d.name) && m >= months - 2) return { ...d, status: (diffDays(today, d.due) > 10 ? "Missed" : "Late") as Deliverable["status"] }
      return d
    })
    return { month: m + 1, start, items }
  })
}

// ── health score ────────────────────────────────────────────────────────────

export type Signal = { area: "Value" | "Engagement" | "Delivery" | "Money" | "People" | "Onboarding"; text: string; weight: number }

export function health(s: State, c: Client) {
  const t = s.today
  const n = dayN(c, t)
  const sig: Signal[] = []
  if (n !== null) {
    const now = hoursBack(c, t)
    const before = hoursBack(c, addDays(t, -28))
    const off = c.agents.filter((a) => a.manual === "qa" && !a.liveDate).length
    if (n > 30 && before > 0 && now < before * 0.9) sig.push({ area: "Value", text: `Hours back down ${Math.round((1 - now / before) * 100)}% in 4 weeks`, weight: 18 })
    if (off) sig.push({ area: "Value", text: `${off} agents switched off`, weight: 10 })
    if (c.usagePct !== null && c.usagePct < 60 && n > 45) sig.push({ area: "Value", text: `Only ${c.usagePct}% of the team uses the agents`, weight: 16 })
    const e = c.engagement
    if (e && e.reportOpens30 < 2) sig.push({ area: "Engagement", text: `Owner opened ${e.reportOpens30 === 0 ? "no reports" : "1 report"} in 30 days`, weight: 12 })
    if (e && e.reviewsMissed) sig.push({ area: "Engagement", text: `Missed ${e.reviewsMissed} monthly ${e.reviewsMissed === 1 ? "review" : "reviews"}`, weight: 12 })
    const mood = c.slackConnected ? sentiment(c, s) : null
    if (mood && mood.score < -10) sig.push({ area: "Engagement", text: `Slack mood ${mood.label.toLowerCase()} (${mood.score})`, weight: 10 })
    const cov = captured(c, c.seats, t).pct
    if (n > 7 && cov < 80) sig.push({ area: "Engagement", text: `Only ${cov}% of working hours recorded`, weight: 8 })
    const lateItems = recurringMonths(c, t).flatMap((m) => m.items).filter((d) => d.status === "Late" || d.status === "Missed")
    if (lateItems.length) sig.push({ area: "Delivery", text: `${lateItems.length} deliverables late or missed: ${lateItems.slice(0, 2).map((d) => d.name.toLowerCase()).join(", ")}`, weight: 8 + lateItems.length * 4 })
    const ah = agentHealth(s).filter((x) => x.c.id === c.id && x.signals.length)
    if (ah.length >= 3) sig.push({ area: "Delivery", text: `${ah.length} agents below spec`, weight: 8 })
    const b = billing(s, c)
    if (c.sub?.cancelAt) sig.push({ area: "Money", text: `Set to cancel on ${fmt(c.sub.cancelAt)}: ${c.sub.cancelReason ?? "Other"}${c.sub.cancelNote ? `. ${c.sub.cancelNote}` : ""}`, weight: 45 })
    if (b.invoices.some((x) => x.status === "failed")) sig.push({ area: "Money", text: "Last payment failed", weight: 20 })
    else if (b.sub?.card.expiresSoon) sig.push({ area: "Money", text: "Card on file expires this month", weight: 6 })
    const ph = phase(c, t)
    if (ph === "recurring" && b.sub?.renews && diffDays(b.sub.renews, t) <= 14 && sig.length) sig.push({ area: "Money", text: "Renews within 14 days", weight: 4 })
    // The renewal itself: undecided after day 90 bills nothing, so it weighs heavily.
    const late = overdueDays(c, t)
    if (late) sig.push({ area: "Money", text: `Renewal undecided ${late} ${late === 1 ? "day" : "days"} after day 90: nothing is billing`, weight: 35 })
    else if (n >= 80 && n <= 90 && renewalStage(c, t) !== "Proposal sent" && renewalStage(c, t) !== "Renewed") sig.push({ area: "Money", text: `Day 90 in ${90 - n} days and no renewal proposal sent`, weight: 12 })
    // A missed day-90 guarantee keeps counting after day 90.
    if (past90(c, t) && guarantees(c, t).d90 === "missed") sig.push({ area: "Value", text: "Day-90 guarantee missed: under 40 h/wk back", weight: 22 })
    // In the first 90 days, the onboarding risks (missed requirements, guarantees at risk) count too.
    if (!past90(c, t)) risk(c, t).slice(0, 3).forEach((x) => sig.push({ area: "Onboarding", text: x, weight: 10 }))
    if (e?.ownerLeft) sig.push({ area: "People", text: "The owner's champion left the company", weight: 18 })
  }
  const score = Math.max(0, 100 - sig.reduce((x, y) => x + y.weight, 0))
  // A client already set to cancel is at risk whatever the other signals say.
  const level = c.sub?.cancelAt || overdueDays(c, t) ? "At risk" : score >= 75 ? "Healthy" : score >= 50 ? "Watch" : "At risk"
  return { score, level: level as "Healthy" | "Watch" | "At risk", signals: sig.sort((a, b) => b.weight - a.weight), mrr: n === null ? 0 : revenueMo(s, c, t), atStake: n === null ? 0 : listFor(s, c, t), recurring: phase(c, t) === "recurring", phase: phase(c, t) }
}

/** Portfolio retention: revenue at risk, renewals coming, churn and revenue kept (sample history). */
export function retention(s: State) {
  // Lost clients leave the health table and are counted as churn instead.
  const all = s.clients.map((c) => ({ c, h: health(s, c), b: billing(s, c) }))
  const rows = all.filter((r) => r.h.phase !== "ended")
  // Everyone who left, by either route, with one reason list.
  const lost = s.clients.flatMap((c) => { const ch = churnOf(c, s.today); return ch ? [{ c, ...ch }] : [] }).sort((a, b) => b.at.localeCompare(a.at))
  const mrr = rows.reduce((n, r) => n + r.h.mrr, 0)
  // What we stand to lose is the full price, even while a client is paused or discounted.
  const atRisk = rows.filter((r) => r.h.level === "At risk").reduce((n, r) => n + r.h.atStake, 0)
  const watch = rows.filter((r) => r.h.level === "Watch").reduce((n, r) => n + r.h.atStake, 0)
  // Renewals: day 90 within 60 days, or already past with no decision.
  const renewals = rows.filter((r) => { const n = dayN(r.c, s.today); return n !== null && ((!past90(r.c, s.today) && n >= 30 && r.c.renewal?.stage !== "Renewed") || overdueDays(r.c, s.today) > 0) })
    .map((r) => ({ ...r, stage: renewalStage(r.c, s.today), due: day91(r.c), overdue: overdueDays(r.c, s.today) }))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))
  // Churn by month: real lost renewals and cancellations, on top of sample history before them.
  const monthsAgo = (d: ISODate | null | undefined) => (d ? Math.floor(diffDays(s.today, d) / 30) : 99)
  const real = (i: number) => lost.filter((x) => monthsAgo(x.at) === 5 - i).length
  const months = Array.from({ length: 6 }, (_, i) => ({ month: i, churn: [0, 0, 1, 0, 0, 0][i] + real(i), nrr: Math.round(100 + (hash("nrr" + i) - 0.35) * 12) }))
  return { rows, lost, mrr, arr: mrr * 12, atRisk, watch, renewals, months, agentLive: (c: Client) => c.agents.filter((a) => agentStatus(a, c, s.today) === "live").length }
}

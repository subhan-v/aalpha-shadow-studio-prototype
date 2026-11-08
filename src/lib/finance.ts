// Money for Aalpha (Studio only, never the client app): what each client pays, what serving
// them costs week by week, margins, and Stripe-shaped billing data. Prices are a setting with
// dates, so the recurring price can change as the client base grows while existing clients
// keep the price they signed at. Sample numbers, stable per client and week.

import { addDays, diffDays, hash } from "./dates"
import { agentResults } from "./results"
import { agentStatus, dayN, seatStats } from "./engine"
import { past90, phase } from "./renewal"
import type { Client, ISODate, State } from "./types"

export const DEFAULT_PRICING: NonNullable<State["pricing"]> = { recurring: [{ from: "2026-01-01", monthly: 3000 }], upfront: 5000, monthly: 6000 }
export const pricingOf = (s: State) => s.pricing ?? DEFAULT_PRICING

/** The list price for the recurring plan on a given day. */
export function listPrice(s: State, on: ISODate) {
  const p = [...pricingOf(s).recurring].sort((a, b) => a.from.localeCompare(b.from)).filter((x) => x.from <= on)
  return (p[p.length - 1] ?? pricingOf(s).recurring[0]).monthly
}

/** The monthly price after the 90 days: what they renewed at, or what we would propose. */
export const recurringPrice = (s: State, c: Client) => c.renewal?.price ?? c.price ?? listPrice(s, addDays(c.kickoffDate!, 90))
const onboardingPrice = (s: State, c: Client) => (c.plan === "upfront" ? pricingOf(s).upfront : pricingOf(s).monthly)

/** What a client pays a month on a given day: onboarding by plan, then the recurring price only
 *  once the renewal is recorded. Nothing bills while a renewal is undecided or after a loss. */
export function revenueMo(s: State, c: Client, on: ISODate) {
  const ph = phase(c, on)
  if (ph !== "onboarding" && ph !== "recurring") return 0
  const sub = c.sub
  // Admin changes: a paused or cancelled subscription bills nothing; a discount takes its share off.
  if (sub?.paused && sub.paused.from <= on && (!sub.paused.until || on < sub.paused.until)) return 0
  if (sub?.cancelAt && sub.cancelAt <= on) return 0
  const base = ph === "onboarding" ? onboardingPrice(s, c) : recurringPrice(s, c)
  const d = sub?.discount && (!sub.discount.from || on >= sub.discount.from) && (!sub.discount.until || on < sub.discount.until) ? sub.discount.pct : 0
  return Math.round(base * (1 - d / 100))
}

/** The price before any discount, and what is at stake while a renewal is open. Nothing once lost. */
export function listFor(s: State, c: Client, on: ISODate) {
  const ph = phase(c, on)
  return ph === "ended" ? 0 : ph === "onboarding" || ph === "not started" ? onboardingPrice(s, c) : recurringPrice(s, c)
}

// Changes we made to cut costs, shown on the trend so you can see whether each one worked.
export const COST_CHANGES: { date: ISODate; text: string; factor: number }[] = [
  { date: "2026-09-28", text: "Screenshots 40% smaller", factor: 0.86 },
  { date: "2026-10-12", text: "Screen analysis moved to the smaller model", factor: 0.8 },
]
const efficiency = (d: ISODate) => COST_CHANGES.filter((x) => x.date <= d).reduce((n, x) => n * x.factor, 1)

export type CostWeek = { end: ISODate; ai: number; storage: number; agents: number; total: number; revenue: number; margin: number | null; spike: string | null; seatDays: number }

/** Twelve weeks of cost and margin for one client. A week over 2x the 4 weeks before is a spike. */
export function costWeeks(s: State, c: Client, today: ISODate, weeks = 12): CostWeek[] {
  const out: CostWeek[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const end = addDays(today, -7 * w)
    let seatDays = 0
    for (let i = 0; i < 7; i++) seatDays += seatStats(c, addDays(end, -i)).active
    // Northline's silent computer re-sent its backlog: the sample spike, in the latest week.
    const spikeX = c.id === "northline" && w === 0 ? 2.6 : 1
    const ai = seatDays * c.costPerSeatDay * efficiency(end) * (0.92 + hash(c.id + end) * 0.16) * spikeX
    const storage = seatDays * 0.04 * efficiency(end)
    const agents = dayN(c, end) === null ? 0 : agentResults(c, end).reduce((n, x) => n + x.costMo / 4.33, 0)
    const total = Math.round(ai + storage + agents)
    const revenue = Math.round(revenueMo(s, c, end) / 4.33)
    out.push({ end, ai: Math.round(ai), storage: Math.round(storage), agents: Math.round(agents), total, revenue, margin: revenue ? Math.round(((revenue - total) / revenue) * 100) : null, spike: null, seatDays })
  }
  out.forEach((x, i) => {
    const prior = out.slice(Math.max(0, i - 4), i).filter((y) => y.total > 0)
    const avg = prior.length ? prior.reduce((n, y) => n + y.total, 0) / prior.length : 0
    if (avg && x.total > 2 * avg) x.spike = c.seats.some((y) => y.silentFrom && !y.silentTo) ? "Silent computers re-sending their backlog" : "More screen analysis than usual"
  })
  return out
}

/** The last 30 days of cost to serve, from the same weekly numbers as the charts, plus revenue. */
export function cost30(s: State, c: Client) {
  const w = costWeeks(s, c, s.today, 4)
  const k = 30 / 28
  const ai = w.reduce((n, x) => n + x.ai, 0) * k, storage = w.reduce((n, x) => n + x.storage, 0) * k, agents = w.reduce((n, x) => n + x.agents, 0) * k
  const seatDays = w.reduce((n, x) => n + x.seatDays, 0) * k
  const revenue = revenueMo(s, c, s.today)
  const total = ai + storage + agents
  return { ai: Math.round(ai), storage: Math.round(storage), agents: Math.round(agents), total: Math.round(total), seatDays: Math.round(seatDays), perSeatDay: seatDays ? ai / seatDays : 0, revenue, margin: revenue ? Math.round(((revenue - total) / revenue) * 100) : 0 }
}

/** All clients added up, week by week. */
export function portfolioWeeks(s: State, today: ISODate) {
  const per = s.clients.map((c) => costWeeks(s, c, today))
  return per[0].map((_, i) => {
    const sum = (k: "ai" | "storage" | "agents" | "total" | "revenue" | "seatDays") => per.reduce((n, w) => n + w[i][k], 0)
    const total = sum("total"), revenue = sum("revenue")
    return { end: per[0][i].end, seatDays: sum("seatDays"), ai: sum("ai"), storage: sum("storage"), agents: sum("agents"), total, revenue, margin: revenue ? Math.round(((revenue - total) / revenue) * 100) : null, spike: per.some((w) => w[i].spike) ? per.filter((w) => w[i].spike).length + " clients spiked" : null }
  })
}

/** Are we getting cheaper to serve? Judged on cost per person per day (the latest 4 weeks against
 *  the 4 before), because the total also grows when more people start recording. */
export function costVerdict(w: CostWeek[]) {
  const unit = (x: CostWeek[]) => { const d = x.reduce((n, y) => n + y.seatDays, 0); return d ? x.reduce((n, y) => n + y.total, 0) / d : 0 }
  const now = unit(w.slice(-4)), before = unit(w.slice(-8, -4))
  const tot = (x: CostWeek[]) => x.reduce((n, y) => n + y.total, 0)
  const totalPct = tot(w.slice(-8, -4)) ? Math.round(((tot(w.slice(-4)) - tot(w.slice(-8, -4))) / tot(w.slice(-8, -4))) * 100) : 0
  if (!before) return { pct: 0, word: "No trend yet", good: true, note: "" }
  const pct = Math.round(((now - before) / before) * 100)
  const word = pct <= -3 ? `Cost per person per day down ${-pct}%` : pct >= 3 ? `Cost per person per day up ${pct}%` : "Cost per person per day flat"
  // A total compared with weeks before the client started says nothing, so leave it out then.
  const full = w.slice(-8, -4).length === 4 && w.slice(-8, -4).every((x) => x.total > 0)
  const note = `$${now.toFixed(2)} now, against $${before.toFixed(2)} before.${full ? ` Total ${totalPct >= 0 ? "up" : "down"} ${Math.abs(totalPct)}%${totalPct > 0 ? " as more people record" : ""}.` : ""}`
  return { pct, word, good: pct < 3, note }
}

/** Unit costs for one client over the last 4 weeks. */
export function unitCosts(c: Client, w: CostWeek[], today: ISODate) {
  const four = w.slice(-4)
  const cost = four.reduce((n, x) => n + x.total, 0)
  let seatDays = 0
  for (let i = 0; i < 28; i++) seatDays += seatStats(c, addDays(today, -i)).active
  const found = c.foundTarget * 4
  const back = agentResults(c, today).reduce((n, x) => n + x.hrsWk, 0) * 4
  return { perSeatDay: seatDays ? cost / seatDays : 0, perHourFound: found ? cost / found : 0, perHourBack: back ? cost / back : null }
}

// ── Stripe-shaped billing (sample until Stripe is connected) ────────────────

export type Invoice = { id: string; clientId: string; date: ISODate; amount: number; status: "paid" | "open" | "failed" }
export type Subscription = { id: string; clientId: string; plan: string; amount: number; status: "active" | "past_due" | "paused" | "canceling" | "canceled" | "on_hold" | "ended"; renews: ISODate | null; card: { last4: string; exp: string; expiresSoon: boolean } }

export function billing(s: State, c: Client) {
  const n = dayN(c, s.today)
  if (n === null) return { sub: null, invoices: [] as Invoice[] }
  const amount = revenueMo(s, c, s.today)
  const ph = phase(c, s.today)
  const invoices: Invoice[] = []
  // The last six monthly invoices, counting from the day they signed.
  // Invoice m falls 30 days apart from signing, on the billing day if one is set.
  const due = (m: number) => { const d = addDays(c.signedDate, 30 * m); return c.sub?.billingDay ? `${d.slice(0, 8)}${String(c.sub.billingDay).padStart(2, "0")}` : d }
  const k = Math.floor(diffDays(s.today, c.signedDate) / 30)
  for (let m = Math.max(0, k - 5); m <= k; m++) {
    const date = due(m)
    if (date > s.today) continue
    // Upfront: one invoice for the whole 90 days at signing, nothing more until the monthly plan.
    if (c.plan === "upfront" && !past90(c, date) && m > 0) continue
    // After day 90 an invoice only goes out once the renewal is recorded.
    if (past90(c, date) && phase(c, date) !== "recurring") continue
    const price = !past90(c, date) ? (c.plan === "upfront" ? pricingOf(s).upfront * 3 : pricingOf(s).monthly) : revenueMo(s, c, date)
    const failed = !!c.deliveryLate?.length && date > addDays(s.today, -30)
    invoices.push({ id: `in_${c.id}_${m}`, clientId: c.id, date, amount: price, status: failed ? "failed" : date > addDays(s.today, -3) ? "open" : "paid" })
  }
  // Nothing renews while the renewal is undecided or after a loss.
  const renews = ph === "awaiting renewal" || ph === "ended" ? null : due(k + 1)
  const expMonth = 1 + Math.floor(hash(c.id + "exp") * 12)
  const expiresSoon = !!c.deliveryLate?.length || hash(c.id + "card") > 0.85
  const sub: Subscription = {
    id: `sub_${c.id}`, clientId: c.id, plan: ph === "recurring" ? "Recurring" : ph === "awaiting renewal" ? "Awaiting renewal" : ph === "ended" ? "Ended at day 90" : c.plan === "upfront" ? "90 days, paid upfront" : "90 days, monthly", amount,
    status: ph === "ended" ? "ended" : ph === "awaiting renewal" ? "on_hold" : c.sub?.cancelAt && c.sub.cancelAt <= s.today ? "canceled" : c.sub?.cancelAt ? "canceling" : c.sub?.paused && c.sub.paused.from <= s.today && (!c.sub.paused.until || s.today < c.sub.paused.until) ? "paused" : invoices.some((x) => x.status === "failed") ? "past_due" : "active", renews,
    card: { last4: String(1000 + Math.floor(hash(c.id) * 8999)).slice(-4), exp: expiresSoon ? `${s.today.slice(5, 7)}/${s.today.slice(2, 4)}` : `${String(expMonth).padStart(2, "0")}/28`, expiresSoon },
  }
  // One-off credits come off the latest invoice.
  const credit = (c.sub?.credits ?? []).filter((x) => x.at > addDays(s.today, -30)).reduce((n, x) => n + x.amount, 0)
  if (credit && invoices.length) invoices[invoices.length - 1] = { ...invoices[invoices.length - 1], amount: Math.max(0, invoices[invoices.length - 1].amount - credit) }
  return { sub, invoices: invoices.reverse() }
}

export const liveAgentCount = (c: Client, today: ISODate) => c.agents.filter((a) => agentStatus(a, c, today) === "live").length

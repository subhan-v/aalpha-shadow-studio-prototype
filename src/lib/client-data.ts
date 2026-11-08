// Numbers the client app shows, derived from the same client record Studio edits.
// Only published workflows count, so the review gate is visible end to end.

import { addDays, hash, weekday } from "./dates"
import { agentStatus, dayN, hoursBack, installed, silent, visibleWorkflows } from "./engine"
import type { Category, Client, Goal, ISODate, Tier } from "./types"

export const WK_TO_MO = 4.33

export function goalProgress(c: Client, g: Goal, today: ISODate) {
  const vis = visibleWorkflows(c, today).filter((w) => !w.neverAutomate)
  const inCat = vis.filter((w) => g.categories.includes(w.category))
  const found = inCat.reduce((n, w) => n + w.hoursWk, 0)
  const all = vis.reduce((n, w) => n + w.hoursWk, 0) || 1
  // Hours back from the live agents doing this goal's kind of work; agents without a category share pro rata.
  const live = c.agents.filter((a) => agentStatus(a, c, today) === "live")
  const tagged = live.some((a) => a.category)
  const back = tagged ? live.filter((a) => a.category && g.categories.includes(a.category)).reduce((n, a) => n + a.baselineHrsWk * a.savesPct, 0) : hoursBack(c, today) * (found / all)
  return { found, back, recs: [...inCat].sort((a, b) => b.hoursWk - a.hoursWk).slice(0, 3) }
}

export function teamStats(c: Client, today: ISODate) {
  // Work someone said must never be automated is not an opportunity.
  const vis = visibleWorkflows(c, today).filter((w) => !w.neverAutomate)
  const tier = (t: Tier) => vis.filter((w) => w.tier === t).reduce((n, w) => n + w.hoursWk * WK_TO_MO, 0)
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const daily = days.map((d) => {
    const wk = weekday(d) === 0 || weekday(d) === 6
    const active = c.seats.filter((s) => installed(s, d) && !silent(s, d)).length
    return { d, h: Math.round(active * (wk ? 0.35 : 6.6 + hash(c.id + d) * 1.2)) }
  })
  const observed = daily.reduce((n, x) => n + x.h, 0)
  const H = tier("H"), M = tier("M"), L = tier("L")
  const total = H + M + L
  const rate = 38 // loaded $/h, set per client at kickoff in the real system
  const dollars = vis.reduce((n, w) => n + valueMo(c, w.hoursWk, w.category), 0)
  return { H, M, L, total, hires: total / 160, dollars, rate, observed, daily, workflows: vis.length }
}

export const CATS: Category[] = ["Reporting", "Paid media", "Ops and admin", "Client delivery", "Creative", "Sales"]

export function byCategory(c: Client, today: ISODate) {
  const vis = visibleWorkflows(c, today)
  return CATS.map((k) => {
    const w = vis.filter((x) => x.category === k)
    const t = (tt: Tier) => w.filter((x) => x.tier === tt).reduce((n, x) => n + x.hoursWk * WK_TO_MO, 0)
    return { name: k, H: t("H"), M: t("M"), L: t("L"), total: t("H") + t("M") + t("L") }
  }).filter((x) => x.total > 0)
}

export const MIX: [string, number][] = [["Client delivery", 0.38], ["Messages and meetings", 0.24], ["Reporting", 0.12], ["Admin and ops", 0.11], ["Sales", 0.08], ["Tools and AI", 0.04], ["Other", 0.03]]

/** A person's own week, for My time. */
export function myWeek(seatId: string) {
  const h = (k: string) => hash(seatId + k)
  const hours = Math.round(30 + h("h") * 14)
  const heat = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, di) => ({
    day: d,
    cells: Array.from({ length: 11 }, (_, i) => {
      const peak = i >= 1 && i <= 9 && i !== 5
      return Math.round((peak ? 30 + h(d + i) * 30 : h(d + i) * 15) * (di === 4 && i > 7 ? 0.3 : 1))
    }),
  }))
  const types: [string, number][] = [["Messages", 0.36], ["Client work", 0.27], ["Meetings", 0.16], ["Docs", 0.11], ["Admin", 0.06], ["Tools and AI", 0.04]]
  return {
    hours,
    messagesPct: Math.round(types[0][1] * 100 + h("m") * 8),
    focus: Math.round(14 + h("f") * 30),
    afterHours: Math.round(8 + h("a") * 26),
    heat,
    types: types.map(([n, p]) => ({ name: n, hours: Math.round(hours * p * 10) / 10 })),
    stretches: [["Under 1m", Math.round(300 + h("s1") * 200)], ["1-5m", Math.round(80 + h("s2") * 40)], ["5-15m", Math.round(30 + h("s3") * 20)], ["15-25m", Math.round(6 + h("s4") * 10)], ["25m+", Math.round(h("s5") * 6)]] as [string, number][],
  }
}

export const PROCESSES: { name: string; cats: Category[]; stages: [string, number][] }[] = [
  { name: "Monthly reporting cycle", cats: ["Reporting"], stages: [["Pull data", 20], ["Build", 48], ["QA", 12], ["Send", 10]] },
  { name: "Campaign launch", cats: ["Paid media", "Creative"], stages: [["Brief", 35], ["Creative", 180], ["Approval", 1140], ["Launch", 40], ["Pacing", 25]] },
  { name: "Client onboarding", cats: ["Ops and admin", "Client delivery"], stages: [["Signed", 10], ["Setup", 160], ["Kickoff", 60], ["First report", 90]] },
  { name: "Lead to signed", cats: ["Sales"], stages: [["Lead in", 5], ["First reply", 342], ["Call", 30], ["Proposal", 48], ["Signed", 15]] },
]

export function processes(c: Client, today: ISODate) {
  const vis = visibleWorkflows(c, today)
  return PROCESSES.map((p) => ({ ...p, hours: vis.filter((w) => p.cats.includes(w.category)).reduce((n, w) => n + w.hoursWk * WK_TO_MO, 0), count: vis.filter((w) => p.cats.includes(w.category)).length })).filter((p) => p.count > 0)
}

export function liveAgents(c: Client, today: ISODate) {
  return c.agents.map((a) => ({ a, status: agentStatus(a, c, today) }))
}

// ── insights the audit says to lead with (sample, stable per client) ────────

export const RATE = 38 // loaded $/h, set per client at kickoff in the real system
export const dollarsMo = (hoursWk: number) => hoursWk * WK_TO_MO * RATE

/** #4 Slack asks by topic: open, done, hours to done. */
export function slackAsks(c: Client, today: ISODate) {
  if (!c.slackConnected) return null
  const topics = ["Report changes", "Access and logins", "Creative revisions", "Campaign changes", "Billing questions"]
  const rows = topics.map((t, i) => {
    const h = (k: string) => hash(c.id + t + k)
    const total = Math.round(8 + h("n") * 30 * (1 - i * 0.12))
    const open = Math.round(total * (0.12 + h("o") * 0.25))
    return { topic: t, total, open, done: total - open, hoursToDone: Math.round((3 + h("h") * 30) * 10) / 10 }
  })
  const total = rows.reduce((n, r) => n + r.total, 0)
  const open = rows.reduce((n, r) => n + r.open, 0)
  const med = [...rows].sort((a, b) => a.hoursToDone - b.hoursToDone)[2].hoursToDone
  return { rows, total, open, done: total - open, medianHours: med, linkedPct: Math.round(35 + hash(c.id + today.slice(0, 7)) * 40) }
}

/** #5 Handoffs and bottlenecks: where work waits between teams. */
export function handoffs(c: Client) {
  const pairs: [string, string][] = [["Account management", "Creative"], ["Creative", "Account management"], ["Account management", "Paid media"], ["Paid media", "Account management"], ["Sales", "Ops and admin"], ["SEO and content", "Account management"]]
  return pairs.map(([a, b]) => ({ from: a, to: b, count: Math.round(10 + hash(c.id + a + b) * 50), waitHrs: Math.round((2 + hash(c.id + b + a) * 26) * 10) / 10 })).sort((x, y) => y.waitHrs - x.waitHrs)
}

/** #6 Response time to @mentions, team median only (per-person needs a privacy call). */
export function responseTime(c: Client) {
  const h = hash(c.id + "rt")
  return { medianMin: Math.round(18 + h * 70), within1h: Math.round(48 + h * 30), buckets: [["Under 15m", 0.31], ["15m to 1h", 0.27], ["1 to 4h", 0.22], ["4 to 24h", 0.14], ["Over a day", 0.06]] as [string, number][] }
}

/** #3 weekly trend for a process: hours in its workflows over the last 6 weeks. */
export function processTrend(c: Client, name: string, hours: number) {
  return Array.from({ length: 6 }, (_, i) => Math.round(hours / WK_TO_MO * (0.82 + hash(c.id + name + i) * 0.36) * 10) / 10)
}

// ── pilot owner's asks: dollars from payroll, plain names, before vs after, per person ──

export { ROLE_CATS } from "./roles"
import { ROLE_CATS } from "./roles"

/** Loaded hourly rate of the people who do this kind of work (payroll), or the default estimate. */
export function rateFor(c: Client, cat: string): { rate: number; source: "payroll" | "estimate" } {
  if (c.connections.payroll === "none") return { rate: RATE, source: "estimate" }
  const who = c.seats.filter((s) => (ROLE_CATS[s.role] ?? []).includes(cat))
  if (!who.length) return { rate: RATE, source: "estimate" }
  return { rate: Math.round(who.reduce((n, s) => n + (c.pay[s.id] ?? RATE), 0) / who.length), source: "payroll" }
}

export const valueMo = (c: Client, hoursWk: number, cat: string) => hoursWk * WK_TO_MO * rateFor(c, cat).rate

/** Before Shadow, last 30 days, now: the "did it work" view the pilot owner asked for. */
export function beforeAfter(c: Client, today: ISODate) {
  const back = hoursBack(c, today)
  const rt = responseTime(c)
  const n = Math.max(0, (dayN(c, today) ?? 0))
  const mid = Math.min(1, n / 60)
  return [
    { name: "Speed of response to client messages", unit: "min", better: "down" as const, before: Math.round(rt.medianMin * 1.45), mid: Math.round(rt.medianMin * (1.45 - 0.25 * mid)), now: rt.medianMin },
    { name: "Hours a week on repeat work", unit: "h", better: "down" as const, before: c.foundTarget, mid: Math.round((c.foundTarget - back * 0.5) * 10) / 10, now: Math.round((c.foundTarget - back) * 10) / 10 },
    { name: "Hours a week handed to agents", unit: "h", better: "up" as const, before: 0, mid: Math.round(back * 0.5 * 10) / 10, now: Math.round(back * 10) / 10 },
    { name: "Share of time in messages", unit: "%", better: "down" as const, before: 41, mid: Math.round(41 - 4 * mid), now: Math.round(41 - 7 * mid) },
  ]
}

/** A person's recording hours: their own schedule if an owner or manager set one, else the team's. */
export function scheduleFor(c: Client, seatId: string) {
  return c.schedules[seatId] ?? { days: c.capture.days, start: c.capture.start, end: c.capture.end }
}

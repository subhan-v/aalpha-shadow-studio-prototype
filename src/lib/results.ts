// Results: the value ledger. Baseline is locked on day 0; every live agent is then measured
// against it (runs, success, how often a person had to step in, minutes saved per run) and
// turned into time, money and effort. Sample numbers, stable per agent.

import { agentLiveDay, agentStatus, dayN, hoursBack, projected90 } from "./engine"
import { RATE, rateFor, responseTime, WK_TO_MO } from "./client-data"
import type { Client, ISODate } from "./types"

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

/** Average loaded $ an hour across the team: payroll or pay stubs where we have them. */
export function teamRate(c: Client) {
  const known = c.seats.filter((x) => c.paySrc?.[x.id] === "Pay stub" || c.connections.payroll !== "none")
  if (!known.length) return { rate: RATE, source: "Estimate" as const }
  return { rate: Math.round(known.reduce((n, x) => n + (c.pay[x.id] ?? RATE), 0) / known.length), source: "Payroll" as const }
}

export function agentResults(c: Client, today: ISODate) {
  const n = dayN(c, today) ?? 0
  const rate = teamRate(c).rate
  return c.agents
    .map((a) => {
      const status = agentStatus(a, c, today)
      const live = agentLiveDay(a, c, today)
      const h = hash(a.id + a.name)
      const daysLive = live === null ? 0 : Math.max(0, n - live)
      const runsWk = 8 + (h % 30)
      const runs = Math.round((runsWk * daysLive) / 7)
      const success = a.blocked ? 71 : 88 + (h % 11)
      const interventions = Math.round(runs * (1 - success / 100) * 1.4)
      const hrsWk = Math.round(a.baselineHrsWk * a.savesPct * 10) / 10
      const minsBefore = Math.round((a.baselineHrsWk * 60) / Math.max(1, runsWk))
      const minsAfter = Math.max(1, Math.round(minsBefore * (1 - a.savesPct)))
      // Price the hours at the rate of the people whose work the agent took over.
      const r = a.category ? rateFor(c, a.category) : { rate, source: "estimate" as const }
      const valueMo = Math.round(hrsWk * WK_TO_MO * r.rate)
      const costMo = Math.round(runsWk * WK_TO_MO * (0.18 + (h % 5) / 20))
      const feedback = (c.agentFeedback ?? []).filter((f) => f.agentId === a.id && f.status !== "Resolved").length
      return { a, status, daysLive, runs, runsWk, success, interventions, hrsWk, minsBefore, minsAfter, rate: r.rate, valueMo, costMo, net: valueMo - costMo, feedback }
    })
    .filter((x) => x.status === "live")
}

export function results(c: Client, today: ISODate) {
  const n = dayN(c, today) ?? 0
  const agents = agentResults(c, today)
  const back = Math.round(hoursBack(c, today) * 10) / 10
  const rate = teamRate(c)
  const rt = responseTime(c)
  const p = Math.min(1, n / 60)
  const valueMo = agents.reduce((s, x) => s + x.valueMo, 0)
  const costMo = agents.reduce((s, x) => s + x.costMo, 0)
  // The average rate the live agents are priced at, so "hours times rate" on screen adds up.
  const agentHrs = agents.reduce((s, x) => s + x.hrsWk, 0)
  const blended = agentHrs ? Math.round(valueMo / (agentHrs * WK_TO_MO)) : rate.rate
  return {
    n,
    baseline: { date: c.kickoffDate, repeatHrs: c.foundTarget, msgShare: 41, responseMin: Math.round(rt.medianMin * 1.45), afterHours: Math.round(c.seats.length * 1.6) },
    agents,
    time: { hrsWk: back, hrsMo: Math.round(back * WK_TO_MO), fte: Math.round((back / 40) * 10) / 10 },
    money: { valueMo, costMo, net: valueMo - costMo, rate: { rate: blended, source: rate.source } },
    effort: [
      { name: "Messages a week", before: Math.round(c.seats.length * 140), now: Math.round(c.seats.length * 140 * (1 - 0.18 * p)) },
      { name: "App switches a day, per person", before: 310, now: Math.round(310 * (1 - 0.14 * p)) },
      { name: "After-hours hours a week, team", before: Math.round(c.seats.length * 1.6), now: Math.round(c.seats.length * 1.6 * (1 - 0.35 * p)) },
      { name: "Times someone had to step in", before: null as number | null, now: agents.reduce((s, x) => s + x.interventions, 0) },
    ],
    capacity: Math.floor(back / 6),
    projected: { hrsWk: Math.round(projected90(c, today) * 10) / 10, valueMo: Math.round(projected90(c, today) * WK_TO_MO * blended) },
    growth: c.connections.hubspot,
  }
}

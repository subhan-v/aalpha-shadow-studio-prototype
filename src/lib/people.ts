// Per-person numbers for the People view, My workflows and the Executive dashboard.
// A workflow's hours are shared across the people whose role does that kind of work, and a
// live agent's hours back are shared the same way. Sample numbers, stable per person.

import { myWeek, ROLE_CATS, WK_TO_MO } from "./client-data"
import { hash } from "./dates"
import { agentStatus, installed, silent, visibleWorkflows } from "./engine"
import type { Client, ISODate, Seat } from "./types"

const doers = (c: Client, cat: string) => c.seats.filter((s) => (ROLE_CATS[s.role] ?? []).includes(cat)).length || 1
/** One person's share of a workflow's hours: split across everyone whose role does that kind of work. */
export const shareOf = (c: Client, w: { hoursWk: number; category: string }) => w.hoursWk / doers(c, w.category)

export function personStats(c: Client, s: Seat, today: ISODate) {
  const cats = ROLE_CATS[s.role] ?? []
  const workflows = visibleWorkflows(c, today).filter((w) => cats.includes(w.category)).sort((a, b) => b.hoursWk - a.hoursWk)
  // Found hours are opportunities only: never-automate work is listed but not counted.
  const foundWk = workflows.filter((w) => !w.neverAutomate).reduce((n, w) => n + shareOf(c, w), 0)
  const agents = c.agents.filter((a) => a.category && cats.includes(a.category))
  const live = agents.filter((a) => agentStatus(a, c, today) === "live")
  const backWk = live.reduce((n, a) => n + (a.baselineHrsWk * a.savesPct) / doers(c, a.category!), 0)
  const rate = c.pay[s.id] ?? 0
  return {
    workflows, agents, live,
    foundWk: Math.round(foundWk * 10) / 10,
    backWk: Math.round(backWk * 10) / 10,
    valueMo: Math.round(backWk * WK_TO_MO * rate),
    fit: c.fit.find((f) => f.seatId === s.id) ?? null,
    status: !installed(s, today) ? "Not installed" : silent(s, today) ? "No data today" : "Recording",
  }
}

// L1 (locked 2026-10-30): one definition each for the three numbers pages used to disagree on.
// Every page reads these; none computes its own.
const pilotCeo = (c: Client, s: Seat) => (c.pilot && s.id === c.seats[0].id ? c.pilot.ceo : null)

/** After hours: share of active time (desktop and Slack together) outside the person's scheduled hours. */
export function afterHoursPct(c: Client, s: Seat) {
  const p = pilotCeo(c, s)
  return p ? p.afterHoursPct : Math.round(8 + hash(s.id + "ah") * 26)
}

/** Focus: hours in blocks of 25 minutes or more, with the longest block as a second line. */
export function focusOf(c: Client, s: Seat) {
  const p = pilotCeo(c, s)
  return { hours: p ? 0 : Math.round((2 + hash(s.id + "fh") * 9) * 10) / 10, longestMin: p ? p.longestFocusMin : Math.round(22 + hash(s.id + "f") * 40) }
}

/** Hand off: the person's share of opportunity workflows in their role (never-automate excluded). */
export const handOffWk = (c: Client, s: Seat, today: ISODate) => personStats(c, s, today).foundWk

/** Leadership time: where the week goes, and how much of it is this company versus other work. */
export function execWeek(c: Client, s: Seat, weekHours?: number) {
  const h = (k: string) => hash(s.id + k)
  const other = c.business?.otherCompanies.length ? (s.role === "CEO" ? 0.14 : 0.03) : 0
  // Pass the hours My time shows, so the two views of one person agree.
  const hours = weekHours ?? myWeek(s.id).hours
  const mix: [string, number][] = [
    ["Meetings", 0.3 + h("m") * 0.04], ["Messages", 0.25 + h("s") * 0.04], ["Approvals and sign-offs", 0.11], ["Deep work", 0.11 + h("d") * 0.04], ["Admin", 0.05],
  ]
  const known = mix.reduce((n, [, p]) => n + p, 0)
  const rest = Math.max(0, 1 - known - other)
  const rows = [...mix.map(([k, p]) => ({ name: k, share: p })), { name: "Other", share: rest }, ...(other ? [{ name: c.business!.otherCompanies[0].name.split(" (")[0], share: other, otherCo: true }] : [])]
  return {
    hours,
    rows: rows.map((r) => ({ ...r, hours: Math.round(hours * r.share * 10) / 10 })),
    thisCo: Math.round((1 - other) * 100),
    otherCo: Math.round(other * 100),
    focus: focusOf(c, s),
    afterHoursPct: afterHoursPct(c, s),
    approvalsWaiting: Math.round(4 + h("w") * 9),
    agentAsks: Math.round(18 + h("u") * 40),
    // Meeting share over the last 6 weeks, oldest first; this week matches "Where the week goes".
    trend: Array.from({ length: 6 }, (_, i) => (i === 5 ? Math.round((rows.find((r) => r.name === "Meetings")?.share ?? 0) * 100) : Math.round((0.36 - i * 0.012 + h("t" + i) * 0.03) * 100))),
  }
}

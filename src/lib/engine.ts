// The rules. Everything a person would otherwise type by hand (stage, risk, the
// state of each guarantee and requirement, alerts, next actions) is calculated
// here from the client's data and today's date.

import { addDays, diffDays, fmt, fridayOf, hash, weekStart } from "./dates"
import { scorecard, wpuReport } from "./delivery"
import { hasConsent } from "./consent"
import { canMoney } from "./access"
import { churned, confirmDataDeleted, day91, offboard, openRenewal, overdueDays, past90, phase, renewalStage, sendProposal } from "./renewal"
import type { Action, Agent, AgentStatus, Alert, Client, ISODate, Req, Seat, Severity, State, Workflow } from "./types"
import { APP } from "@/lib/flags"
import { OFFBOARD_DELETE_DAYS, offboardDeletionDue } from "./retention"

export const TARGET = 40 // hours a week, both guarantees

export const STAGES = [
  { id: "kickoff", name: "Signed and kickoff", window: "Day 0 to 2" },
  { id: "install", name: "Install", window: "48 hours" },
  { id: "measure", name: "Measure", window: "Weeks 1 to 3" },
  { id: "automate", name: "First agent and automate", window: "To day 30" },
  { id: "recover", name: "Recover", window: "Day 31 to 85" },
  { id: "review", name: "Day-90 review", window: "Day 85 to 90" },
  { id: "renewal", name: "Renewal undecided", window: "After day 90, not billing" },
  { id: "monthly", name: "Monthly", window: "After day 90" },
  { id: "lost", name: "Lost", window: "Did not renew, or cancelled" },
] as const
export type StageId = (typeof STAGES)[number]["id"]

// ── time ────────────────────────────────────────────────────────────────────

export function pausedBefore(c: Client, date: ISODate): number {
  return c.pauses.reduce((sum, p) => (p.start < date ? sum + Math.min(p.days, diffDays(date, p.start)) : sum), 0)
}

export function dayN(c: Client, today: ISODate): number | null {
  if (!c.kickoffDate || c.kickoffDate > today) return null
  return diffDays(today, c.kickoffDate) - pausedBefore(c, today)
}

/** Calendar date of day N for this client, counting pauses that start before it. */
export function dateOfDay(c: Client, n: number): ISODate | null {
  if (!c.kickoffDate) return null
  let d = addDays(c.kickoffDate, n)
  for (let i = 0; i < 3; i++) d = addDays(c.kickoffDate, n + pausedBefore(c, d))
  return d
}

// ── seats ───────────────────────────────────────────────────────────────────

export const installed = (s: Seat, today: ISODate) => !!s.installAt && s.installAt <= today
export const silent = (s: Seat, today: ISODate) =>
  installed(s, today) && !!s.silentFrom && s.silentFrom <= today && (!s.silentTo || today < s.silentTo)
export const lowData = (s: Seat, today: ISODate) =>
  installed(s, today) && !silent(s, today) && hash(s.id + today) < 0.04

export function seatStats(c: Client, today: ISODate) {
  const inst = c.seats.filter((s) => installed(s, today))
  const sil = inst.filter((s) => silent(s, today))
  return {
    scope: c.seats.length,
    installed: inst.length,
    silent: sil.length,
    active: inst.length - sil.length,
    consent: c.seats.filter((s) => hasConsent(c, s)).length,
    ci: c.seats.filter((s) => s.ciSurvey).length,
  }
}

// ── agents ──────────────────────────────────────────────────────────────────

export function agentStatus(a: Agent, c: Client, today: ISODate): AgentStatus {
  if (a.liveDate && a.liveDate <= today) return "live"
  // Holds (pulled back to QA, failing QA) stick. "Approved" or "building" is a floor: time still moves it on.
  if (a.manual && a.manual !== "approved" && a.manual !== "building") return a.manual
  const n = dayN(c, today)
  if (n === null) return "proposed"
  let s: AgentStatus = n >= a.plannedLiveDay ? "live" : n >= a.plannedLiveDay - 4 ? "qa" : n >= a.plannedLiveDay - 10 ? "building" : n >= a.plannedLiveDay - 21 ? "approved" : "proposed"
  if (a.blocked && (s === "qa" || s === "live")) s = "qa_failing"
  // Agents run in Viktor; without access nothing gets past QA.
  if (!c.viktorAccess && s === "live") s = "qa"
  const ORDER: AgentStatus[] = ["proposed", "approved", "building", "qa", "qa_failing", "live"]
  if (a.manual && ORDER.indexOf(a.manual) > ORDER.indexOf(s)) s = a.manual
  return s
}

export function agentLiveDay(a: Agent, c: Client, today: ISODate): number | null {
  if (agentStatus(a, c, today) !== "live") return null
  if (a.liveDate) return dayN(c, a.liveDate)
  return a.plannedLiveDay
}

export function hoursBack(c: Client, today: ISODate): number {
  return c.agents.reduce((s, a) => (agentStatus(a, c, today) === "live" ? s + a.baselineHrsWk * a.savesPct : s), 0)
}

export function projected90(c: Client, today: ISODate): number {
  return c.agents.reduce((s, a) => {
    const st = agentStatus(a, c, today)
    if (st === "live") return s + a.baselineHrsWk * a.savesPct
    if (a.blocked || a.plannedLiveDay > 90) return s
    return s + a.baselineHrsWk * a.savesPct
  }, 0)
}

export function hoursFound(c: Client, today: ISODate): number {
  const n = dayN(c, today)
  if (n === null || n < 1) return 0
  const st = seatStats(c, today)
  const coverage = st.scope ? Math.min(1, st.active / st.scope / 0.9) : 0
  return Math.round(c.foundTarget * Math.min(1, n / 14) * coverage)
}

// ── requirements for success ────────────────────────────────────────────────

export function requirements(c: Client, today: ISODate): Req[] {
  const n = dayN(c, today)
  const started = n !== null
  const st = seatStats(c, today)
  const deadline48 = c.kickoffDate ? addDays(c.kickoffDate, 2) : null
  const allByDeadline = !!deadline48 && c.seats.every((s) => !!s.installAt && s.installAt <= deadline48)
  const allNow = st.installed === st.scope

  const r1: Req = !started
    ? { n: 1, name: "Installed on in-scope machines within 48h of kickoff", status: "pending", detail: "Starts at kickoff", source: "Device data" }
    : allByDeadline
      ? { n: 1, name: "Installed on in-scope machines within 48h of kickoff", status: "met", detail: `${st.scope} of ${st.scope}`, source: "Device data" }
      : today <= deadline48!
        ? { n: 1, name: "Installed on in-scope machines within 48h of kickoff", status: "due", detail: `${st.installed} of ${st.scope} · due ${fmt(deadline48!)}`, source: "Device data" }
        : { n: 1, name: "Installed on in-scope machines within 48h of kickoff", status: allNow ? "late" : "missed", detail: allNow ? "All in, but late" : `${st.installed} of ${st.scope} · was due ${fmt(deadline48!)}`, source: "Device data" }

  const day7 = dateOfDay(c, 7)
  const r2: Req = !started
    ? { n: 2, name: "Viktor via our link, or admin access, by day 7", status: "pending", detail: "Starts at kickoff", source: "Marked by specialist" }
    : c.viktorAccess
      ? { n: 2, name: "Viktor via our link, or admin access, by day 7", status: day7 && c.viktorAccess <= day7 ? "met" : "late", detail: `Received ${fmt(c.viktorAccess)}`, source: "Marked by specialist" }
      : day7 && today <= day7
        ? { n: 2, name: "Viktor via our link, or admin access, by day 7", status: "due", detail: `Due ${fmt(day7)}`, source: "Marked by specialist" }
        : { n: 2, name: "Viktor via our link, or admin access, by day 7", status: "missed", detail: `${day7 ? diffDays(today, day7) : 0} days overdue`, source: "Marked by specialist" }

  const r3: Req = c.baselineSigned
    ? { n: 3, name: "Owner signed the rate baseline", status: "met", detail: fmt(c.baselineSigned), source: "Signed file" }
    : { n: 3, name: "Owner signed the rate baseline", status: started && (n ?? 0) > 1 ? "missed" : "due", detail: "At kickoff", source: "Signed file" }

  const r4: Req = st.consent === st.scope
    ? { n: 4, name: "Staff told, consent collected", status: "met", detail: `${st.consent} of ${st.scope}`, source: "Consent form" }
    : { n: 4, name: "Staff told, consent collected", status: started && (n ?? 0) > 7 ? "at_risk" : "due", detail: `${st.consent} of ${st.scope}`, source: "Consent form" }

  const rd = c.readoutDay
  const r5: Req = c.readoutAttended
    ? { n: 5, name: "Owner at the readout and the day-90 review", status: (n ?? 0) >= 90 && !c.day90Attended ? "due" : "met", detail: (n ?? 0) >= 85 ? (c.day90Attended ? "Both attended" : "Day-90 review due") : "Readout attended", source: "Calendar" }
    : { n: 5, name: "Owner at the readout and the day-90 review", status: !started || (n ?? 0) < rd ? "pending" : (n ?? 0) <= rd + 2 ? "due" : "missed", detail: started ? `Readout day ${rd}${dateOfDay(c, rd) ? " · " + fmt(dateOfDay(c, rd)!) : ""}` : "After kickoff", source: "Calendar" }

  const firstLive = c.agents.map((a) => agentLiveDay(a, c, today)).filter((x): x is number => x !== null).sort((a, b) => a - b)[0]
  const r6: Req = firstLive === undefined || (n ?? 0) - firstLive < 14
    ? { n: 6, name: "At least 60% of the team uses the agents", status: "pending", detail: "Measured 2 weeks after first agent", source: "Viktor usage" }
    : (c.usagePct ?? 0) >= 60
      ? { n: 6, name: "At least 60% of the team uses the agents", status: "met", detail: `${c.usagePct}%`, source: "Viktor usage" }
      : { n: 6, name: "At least 60% of the team uses the agents", status: "at_risk", detail: `${c.usagePct ?? 0}%`, source: "Viktor usage" }

  const activeShare = st.installed ? st.active / st.installed : 0
  const r7: Req = !started || st.installed === 0
    ? { n: 7, name: `${APP} active on the whole team in every capture window`, status: "pending", detail: "After install", source: "Device data" }
    : activeShare >= 0.95
      ? { n: 7, name: `${APP} active on the whole team in every capture window`, status: "met", detail: `${Math.round(activeShare * 100)}% active`, source: "Device data" }
      : { n: 7, name: `${APP} active on the whole team in every capture window`, status: "at_risk", detail: `${Math.round(activeShare * 100)}% active · ${st.silent} silent`, source: "Device data" }

  return [r1, r2, r3, r4, r5, r6, r7]
}

// ── guarantees, stage, risk ─────────────────────────────────────────────────

export type GStatus = "met" | "on_track" | "at_risk" | "missed" | "not_started"

export function guarantees(c: Client, today: ISODate) {
  const n = dayN(c, today)
  const found = hoursFound(c, today)
  const back = Math.round(hoursBack(c, today) * 10) / 10
  const proj = Math.round(projected90(c, today) * 10) / 10
  const liveDays = c.agents.map((a) => agentLiveDay(a, c, today)).filter((x): x is number => x !== null)
  const agentBy30 = liveDays.some((d) => d <= 30)
  const plannedBy30 = c.agents.some((a) => !a.blocked && a.plannedLiveDay <= 30)
  const st = seatStats(c, today)
  const foundProjected = c.foundTarget * Math.min(1, st.scope ? st.active / st.scope / 0.9 : 0)

  let d30: GStatus
  if (n === null) d30 = "not_started"
  else if (found >= TARGET && agentBy30) d30 = "met"
  else if (n > 30) d30 = "missed"
  else if (foundProjected < TARGET || (!agentBy30 && !plannedBy30) || (!c.viktorAccess && n > 7)) d30 = "at_risk"
  else d30 = "on_track"

  let d90: GStatus
  if (n === null || liveDays.length === 0) d90 = "not_started"
  else if (n >= 90) d90 = back >= TARGET ? "met" : "missed"
  else d90 = proj >= TARGET ? "on_track" : "at_risk"

  return { n, found, back, proj, agentBy30, d30, d90, day30: dateOfDay(c, 30), day90: dateOfDay(c, 90) }
}

export function stage(c: Client, today: ISODate): StageId {
  const n = dayN(c, today)
  if (n === null) return "kickoff"
  if (churned(c, today)) return "lost"
  if (past90(c, today)) return phase(c, today) === "recurring" ? "monthly" : phase(c, today) === "ended" ? "lost" : "renewal"
  if (n >= 85) return "review"
  const st = seatStats(c, today)
  if (n <= 2 && st.installed < st.scope) return "install"
  const live = c.agents.filter((a) => agentStatus(a, c, today) === "live").length
  if (n > 30 || live >= 3) return "recover"
  if (n >= 10 || live > 0) return "automate"
  return "measure"
}

export function risk(c: Client, today: ISODate): string[] {
  // A lost client has nothing left to save; its outcome is in Retention.
  if (churned(c, today)) return []
  const out: string[] = []
  const reqs = requirements(c, today)
  for (const r of reqs) {
    if (r.status === "missed") out.push(`Requirement ${r.n} missed`)
    else if (r.status === "due" && r.n === 1) out.push("48-hour install clock running")
    else if (r.status === "due" && r.n === 2) {
      const d7 = dateOfDay(c, 7)
      if (d7 && diffDays(d7, today) <= 2) out.push("Viktor access due within 48h")
    }
  }
  const g = guarantees(c, today)
  if (g.d30 === "at_risk" || g.d30 === "missed") out.push(`Day-30 guarantee ${g.d30 === "missed" ? "missed" : "at risk"}`)
  if (g.d90 === "at_risk" || g.d90 === "missed") out.push(`Day-90 guarantee ${g.d90 === "missed" ? "missed" : "at risk"}`)
  const st = seatStats(c, today)
  if (st.installed && st.silent / st.installed > 0.05) out.push(`${st.silent} computers silent`)
  return out
}

// ── next actions ────────────────────────────────────────────────────────────

const touch = (c: Client, today: ISODate, text: string): Client => ({ ...c, log: [{ date: today, text }, ...c.log] })

export function actions(c: Client, today: ISODate): Action[] {
  const a: Action[] = []
  const n = dayN(c, today)
  const st = seatStats(c, today)
  const base = { clientId: c.id, clientName: c.name, owner: c.owner }
  const push = (key: string, severity: Severity, title: string, why: string, due: ISODate, cta: string, run?: Action["run"], linear?: string, tab?: string) =>
    a.push({ ...base, key: `${c.id}:${key}`, severity, title, why, due, cta, run, linear, tab })

  // A lost client only needs offboarding.
  if (churned(c, today)) {
    if (!c.offboardedAt) push("offboard", "High", "Offboard the client", `Remove ${APP} from every computer. All data must then be deleted within ${OFFBOARD_DELETE_DAYS} days.`, today, "Mark offboarded", (x, t) => offboard(x, t))
    else if (!c.dataDeletedAt) {
      const due = offboardDeletionDue(c) ?? today
      push("delete-data", due <= today ? "Critical" : "High", "Delete the client's data", `Everything we hold for ${c.name} must be gone by ${fmt(due)}. Then send the owner the confirmation.`, due, "Mark data deleted", (x, t) => confirmDataDeleted(x, t))
    }
    return a
  }

  if (n === null) {
    const booked = c.kickoffBooked ?? today
    push("prep", "Medium", "Send kickoff prep form and install guide", "So the team can install the day of kickoff.", addDays(booked, -1), "Mark sent", (x, t) => touch(x, t, "Kickoff prep form and install guide sent."))
    push("kickoff", booked <= today ? "Critical" : "High", "Hold the kickoff call", "Starts the 90 days and the 48-hour install clock.", booked, "Mark kickoff held", (x, t) => ({
      ...touch(x, t, "Kickoff held. 48-hour install clock started."),
      kickoffDate: t,
      seats: x.seats.map((s, i) => ({ ...s, installAt: s.installAt ?? (i % 5 === 4 ? null : addDays(t, i % 3 === 0 ? 0 : 1)) })),
    }))
  }
  if (!c.baselineSigned && n !== null) push("baseline", "Critical", "Get the rate baseline signed", "Requirement 3. Without it the guarantees are void.", c.kickoffDate!, "Mark signed", (x, t) => touch({ ...x, baselineSigned: t }, t, "Rate baseline signed."))
  if (!c.goalsCaptured && n !== null) push("goals", "High", "Write up the owner's goals", "Every finding is ranked against them.", addDays(c.kickoffDate!, 1), "Mark captured", (x, t) => touch({ ...x, goalsCaptured: true }, t, "Goals captured from kickoff."))
  if (!c.slackConnected && n !== null) push("slack", "High", "Connect the client's Slack", "Half the findings come from Slack.", addDays(c.kickoffDate!, 1), "Mark connected", (x, t) => touch({ ...x, slackConnected: true }, t, "Slack connected."))

  const missing = c.seats.filter((s) => !installed(s, today))
  if (n !== null && missing.length) {
    const late = c.kickoffDate && today > addDays(c.kickoffDate, 2)
    push(`install-${missing.length}`, late ? "Critical" : "High", `Get ${missing.length} ${missing.length === 1 ? "install" : "installs"} done`, late ? "48-hour clock has passed (Requirement 1)." : `48-hour clock ends ${fmt(addDays(c.kickoffDate!, 2))}.`, late ? today : addDays(c.kickoffDate!, 2), `Nudge ${missing.length}`, (x, t) => ({
      ...touch(x, t, `Install nudge sent to ${missing.length} people.`),
      seats: x.seats.map((s) => (installed(s, t) ? s : { ...s, nudgedAt: t, installAt: s.installAt && s.installAt <= addDays(t, 1) ? s.installAt : addDays(t, 1) })),
    }))
  }
  const noConsent = c.seats.filter((s) => !hasConsent(c, s)).length
  if (n !== null && noConsent) push("consent", n > 7 ? "High" : "Medium", `Get consent from ${noConsent} people`, `Requirement 4. They agree in their Get started${c.consentVersion ? ` (${c.consentVersion})` : ""}. Send a reminder.`, addDays(c.kickoffDate!, 7), "Send reminder", (x, t) => touch(x, t, `Consent reminder sent to ${noConsent} people.`))

  if (st.silent) {
    push(`silent-${today}`, "Medium", `${st.silent} ${st.silent === 1 ? "computer" : "computers"} silent`, c.seats.filter((s) => silent(s, today)).map((s) => s.name).join(", ") + ". No data for 2+ working hours.", today, "Nudge", (x, t) => ({
      ...touch(x, t, `Nudged ${st.silent} silent computers.`),
      seats: x.seats.map((s) => (silent(s, t) ? { ...s, silentTo: addDays(t, 1) } : s)),
    }))
  }
  if (n !== null && !c.viktorAccess) {
    const d7 = dateOfDay(c, 7)!
    const over = today > d7
    push("viktor", over ? "Critical" : "Medium", "Get Viktor installed or admin access", over ? `Requirement 2 is ${diffDays(today, d7)} days overdue. Agents cannot go live without it.` : `Requirement 2, due ${fmt(d7)}.`, over ? today : d7, "Mark received", (x, t) => touch({ ...x, viktorAccess: t }, t, "Viktor admin access received."))
  }
  for (const ag of c.agents) {
    const s = agentStatus(ag, c, today)
    if (s === "qa_failing") push(`qa-${ag.id}`, "High", `Fix the QA run on "${ag.name}"`, `Planned live day ${ag.plannedLiveDay}. ${ag.baselineHrsWk} h/wk waiting on it.`, today, "Mark QA passed", (x, t) => touch({ ...x, agents: x.agents.map((y) => (y.id === ag.id ? { ...y, blocked: null, manual: null, liveDate: x.viktorAccess ? t : null } : y)) }, t, `QA passed: ${ag.name}${x.viktorAccess ? " is live" : ", waiting on Viktor access"}.`), ag.linear)
  }
  if (n !== null && n >= 5) {
    const proposed = c.agents.filter((ag) => agentStatus(ag, c, today) === "proposed" && ag.plannedLiveDay - n <= 28)
    if (proposed.length) push(`approve-${proposed.length}`, "Medium", `Approve the next ${proposed.length === 1 ? "agent" : `${proposed.length} agents`} with the owner`, "From this month's findings. Building starts once approved.", addDays(today, 3), "Mark approved", (x, t) => touch({ ...x, agents: x.agents.map((y) => (proposed.some((p) => p.id === y.id) ? { ...y, manual: "approved" } : y)) }, t, `${proposed.length} agents approved.`))
  }
  if (n !== null && !c.readoutAttended) {
    const rd = dateOfDay(c, c.readoutDay)!
    if (diffDays(rd, today) <= 7) push("readout", diffDays(rd, today) < 0 ? "High" : "Medium", "Hold the readout with the owner", "Requirement 5. Review the findings and approve the automations.", rd, "Mark attended", (x, t) => touch({ ...x, readoutAttended: true }, t, "Readout held with the owner."))
  }
  if (n !== null && n >= 85 && !c.day90Attended) push("d90", "High", "Hold the day-90 review", "Requirement 5 and the day-90 guarantee check.", dateOfDay(c, 90)!, "Mark attended", (x, t) => touch({ ...x, day90Attended: true }, t, "Day-90 review held."))
  // The renewal: open at day 75, propose by day 83, decide by day 90. Nothing bills after day 90 until it is decided.
  const rs = renewalStage(c, today)
  const d91 = day91(c)
  if (rs === "Due to open") push("renewal", "Medium", "Open the renewal", "Day 75. The monthly plan only starts once the renewal is recorded.", today, "Open renewal", (x, t) => openRenewal(x, t, "Studio"))
  if (rs === "Open" && n !== null && n >= 80) push("renewal-propose", n >= 86 ? "High" : "Medium", "Send the renewal proposal", "Price and the monthly deliverables, before the day-90 review.", dateOfDay(c, 83)!, "Mark sent", (x, t) => sendProposal(x, t, "Studio", null))
  if ((rs === "Open" || rs === "Proposal sent") && n !== null && n >= 86) {
    const late = overdueDays(c, today)
    push("renewal-decide", "High", late ? `Renewal undecided for ${late} ${late === 1 ? "day" : "days"}` : "Record the renewal decision", late ? "Day 90 has passed and nothing is billing. An Admin records renewed or lost." : "Renewed or lost. An Admin records it; billing after day 90 waits on it.", d91 ?? today, "Open renewal", undefined, undefined, "overview")
  }

  // ── delivery work ──
  if (n !== null) {
    const queue = reviewQueue(c, today)
    if (queue.length) push(`review-${queue.length}`, queue.length >= 5 ? "High" : "Medium", `Review ${queue.length} new ${queue.length === 1 ? "workflow" : "workflows"}`, "Nothing reaches the client until it is reviewed and published.", addDays(today, 1), "Open review queue", undefined, undefined, "review")
    if (c.goals.length === 0) push("goals-draft", "High", "Draft the client's goals", "From the kickoff call. Findings are ranked against them.", addDays(c.kickoffDate!, 2), "Open goals", undefined, undefined, "goals")
    else if (c.goals.some((g) => g.status === "draft" && (g.level ?? "company") === "company" && !g.source)) push("goals-pub", "Medium", "Publish the goals to the client", "Drafted, not visible to the client yet.", addDays(today, 2), "Open goals", undefined, undefined, "goals")
    const pubSops = c.sops.filter((x) => x.status === "published").length
    if (n >= 10 && pubSops < 4) push(`sops-${pubSops}`, n >= 21 ? "High" : "Medium", c.sops.length ? `Finish the Ops Playbook (${pubSops} of 4 SOPs published)` : "Draft the first SOPs for the Ops Playbook", "Founder bonus. Playbook v1 is due by day 21.", dateOfDay(c, 21)!, "Open Playbook", undefined, undefined, "playbook")
    const ci = c.seats.filter((x) => x.ciSurvey).length / Math.max(1, c.seats.length)
    if (n >= 10 && !c.fitImported) push("fit-import", ci >= 0.7 ? "Medium" : "Low", ci >= 0.7 ? "Import the Culture Intelligence results" : `Get the survey done (${Math.round(ci * 100)}% so far)`, "Builds the Team Fit Map (founder bonus).", dateOfDay(c, 21)!, "Open Fit Map", undefined, undefined, "fit")
    else if (c.fitImported && !c.fitPublished) push("fit-pub", "Medium", "Publish the Team Fit Map", "Imported, not visible to the client yet.", addDays(today, 2), "Open Fit Map", undefined, undefined, "fit")
    for (const m of [1, 2]) {
      const due = dateOfDay(c, 30 * m)!
      if (n >= 30 * m - 3 && !c.reports.some((r) => r.kind === "scorecard" && r.period === `Month ${m}` && r.status === "sent")) push(`sc${m}`, n > 30 * m ? "High" : "Medium", `Send the month ${m} scorecard`, "Hours back against baseline, agents live, AI spend.", due, "Open reports", undefined, undefined, "reports")
    }
    if (n >= 85 && n <= 100 && !c.reports.some((r) => r.kind === "day90" && r.status === "sent")) push("d90report", "High", "Send the day-90 report", "The before and after, and the day-90 guarantee check.", dateOfDay(c, 90)!, "Open reports", undefined, undefined, "reports")
  }

  // Weekly Progress Update every Friday while the 90 days run.
  if (n !== null && n <= 92) {
    const fri = fridayOf(today)
    if (!c.updatesSent.includes(fri)) {
      const draft = c.reports.find((r) => r.id === `${c.id}-wpu-${fri}`)
      if (draft) push(`wpu-${fri}`, today >= fri ? "High" : "Medium", "Approve and send the Weekly Progress Update", `Draft is ready. Goes to #${c.slackSlug}-shared.`, fri, "Open reports", undefined, undefined, "reports")
      else push(`wpu-${fri}`, today >= fri ? "High" : "Medium", "Draft the Weekly Progress Update", "Built from this week's data, then reviewed before it goes out.", addDays(fri, -1), "Draft it", (x, t) => touch({ ...x, reports: [wpuReport(x, fridayOf(t), "draft"), ...x.reports] }, t, "Weekly Progress Update drafted."))
    }
  }
  const g = guarantees(c, today)
  if (g.d90 === "at_risk" && n !== null && n >= 60) push("d90push", "High", "Close the gap to 40 hours back", `Projected ${g.proj} h/wk at day 90. Add or speed up agents.`, addDays(today, 2), "Open plan")

  const order: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
  return a.sort((x, y) => order[x.severity] - order[y.severity] || x.due.localeCompare(y.due))
}

/** Actions not yet done. Once someone marks an action done it stays off the list. */
export const openActions = (s: State, c: Client) => actions(c, s.today).filter((a) => !s.done[a.key])

// ── alerts ──────────────────────────────────────────────────────────────────

export function alerts(s: State): Alert[] {
  const t = s.today
  const out: Alert[] = []
  if (s.sim.pipelineFailing) {
    out.push({ key: "global:queue", clientId: null, clientName: "All clients", severity: "Critical", title: "Queue stuck: oldest analysis over 24 hours old", detail: "40,226 waiting. Sent to Hashim.", cta: "Open pipeline" })
    out.push({ key: "global:failures", clientId: null, clientName: "All clients", severity: "Critical", title: "Failure spike: vision errors on every screen analysis", detail: "Over 5% failing for the last hour.", cta: "Open errors" })
  }
  for (const c of s.clients) {
    // A lost client is offboarded; it raises no alerts.
    if (churned(c, t)) continue
    const n = dayN(c, t)
    const st = seatStats(c, t)
    const sil = c.seats.filter((x) => silent(x, t))
    if (sil.length) out.push({ key: `${c.id}:silent:${t}`, clientId: c.id, clientName: c.name, severity: sil.some((x) => x.silentFrom && diffDays(t, x.silentFrom) >= 1) ? "Critical" : "Warning", title: `${sil.length} silent ${sil.length === 1 ? "computer" : "computers"}`, detail: sil.map((x) => x.name).join(", ") + " · no data for 2+ working hours", cta: "Nudge", run: (x, tt) => ({ ...x, seats: x.seats.map((y) => (silent(y, tt) ? { ...y, silentTo: addDays(tt, 1) } : y)), log: [{ date: tt, text: "Nudged silent computers from an alert." }, ...x.log] }) })
    if (n !== null && c.kickoffDate && t > addDays(c.kickoffDate, 2) && st.installed < st.scope) out.push({ key: `${c.id}:install`, clientId: c.id, clientName: c.name, severity: "Critical", title: `Install overdue: ${st.installed} of ${st.scope}`, detail: "48-hour clock has passed (Requirement 1).", cta: `Nudge ${st.scope - st.installed}` })
    if (n !== null && !c.slackConnected && n >= 1) out.push({ key: `${c.id}:slack`, clientId: c.id, clientName: c.name, severity: "Warning", title: "Slack not connected", detail: "No Slack data since kickoff.", cta: "Open setup" })
    if (st.scope && n !== null && st.installed >= 1 && st.active < s.settings.seatFloor && st.scope >= s.settings.seatFloor && n > 2) out.push({ key: `${c.id}:floor`, clientId: c.id, clientName: c.name, severity: "Critical", title: `Below the ${s.settings.seatFloor}-seat floor: ${st.active} active`, detail: "The guarantees need 15+ people tracked.", cta: "Open seats" })
    const low = c.seats.filter((x) => lowData(x, t))
    if (low.length) out.push({ key: `${c.id}:low:${t}`, clientId: c.id, clientName: c.name, severity: "Warning", title: `Upload drop: ${low.map((x) => x.name).join(", ")}`, detail: "More than 50% below the 7-day average.", cta: "Check device" })
    const spike = 1.4 + hash(c.id + t + "x") * 1.6
    if (n !== null && hash(c.id + t + "cost") < 0.25 && st.active && spike >= s.settings.costSpikeX) out.push({ key: `${c.id}:cost:${t}`, clientId: c.id, clientName: c.name, severity: "Warning", title: "Cost spike on one computer", detail: canMoney(s) ? `$${(c.costPerSeatDay * spike).toFixed(2)} today vs $${c.costPerSeatDay.toFixed(2)} 7-day average (${spike.toFixed(1)}x).` : `${spike.toFixed(1)}x its 7-day average today.`, cta: "Open costs" })
  }
  return out.filter((a) => !(s.acks[a.key] && t < s.acks[a.key]))
}

// ── monitoring + costs ──────────────────────────────────────────────────────

export function device(sx: Seat, c: Client, s: State) {
  const t = s.today
  const h = hash(sx.id + t)
  const isInst = installed(sx, t)
  const isSil = silent(sx, t)
  const isLow = lowData(sx, t)
  const status = !isInst ? "Not installed" : isSil ? "Silent" : isLow ? "Low data" : "Active"
  const uploads = !isInst || isSil ? 0 : Math.round((isLow ? 0.3 : 1) * (260 + h * 360))
  const failRate = s.sim.pipelineFailing ? 0.08 : 0.004
  return {
    status,
    last: !isInst ? "never" : isSil ? `${Math.max(1, diffDays(t, sx.silentFrom!)) * 24 - Math.round(h * 6)}h ago` : `${Math.round(h * 9)}m ago`,
    version: !isInst ? "-" : h < 0.15 ? "0.9.13" : "0.9.14",
    uploads,
    mb: Math.round(uploads * 0.46),
    failed: Math.round(uploads * failRate),
    waiting: s.sim.pipelineFailing ? Math.round((isSil ? 0.2 : 1) * (200 + h * 1100)) : Math.round(h * 20),
    cost: !isInst || isSil ? 0 : c.costPerSeatDay * (isLow ? 0.4 : 0.75 + h * 0.5),
  }
}

export function costs30(c: Client, today: ISODate) {
  let ai = 0
  let seatDays = 0
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i)
    const st = seatStats(c, d)
    seatDays += st.active
    ai += st.active * c.costPerSeatDay
  }
  const storage = Math.round(seatDays * 0.04) // about 160 MB a computer-day at object-storage rates
  const ph = phase(c, today)
  const revenue = ph === "recurring" ? 3000 : ph === "onboarding" || ph === "not started" ? (c.plan === "upfront" ? 5000 : 6000) : 0
  return { ai: Math.round(ai), storage, seatDays, perSeatDay: seatDays ? ai / seatDays : 0, revenue, margin: revenue ? Math.round(((revenue - ai - storage) / revenue) * 100) : 0 }
}

/** Weekly series for the progress chart: hours found and hours back at the end of each week. */
export function weekly(c: Client, today: ISODate) {
  const out: { week: number; date: ISODate; found: number; back: number }[] = []
  for (let w = 1; w <= 13; w++) {
    const d = dateOfDay(c, w * 7)
    if (!d || d > today) break
    out.push({ week: w, date: d, found: hoursFound(c, d), back: Math.round(hoursBack(c, d) * 10) / 10 })
  }
  return out
}

export function thisWeek(today: ISODate) {
  const mon = weekStart(today)
  return { mon, sun: addDays(mon, 6) }
}


// ── delivery helpers ────────────────────────────────────────────────────────

/** Workflows Shadow has found that nobody has reviewed yet. */
export function reviewQueue(c: Client, today: ISODate): Workflow[] {
  const n = dayN(c, today)
  if (n === null) return []
  return c.workflows.filter((w) => w.review === "new" && !w.mergedInto && w.discoveredDay <= n)
}

/** What the client can see: reviewed, published, found by now. */
export function visibleWorkflows(c: Client, today: ISODate): Workflow[] {
  const n = dayN(c, today) ?? -1
  return c.workflows.filter((w) => w.review === "published" && !w.mergedInto && w.discoveredDay <= n)
}

export function assignee(s: State, a: Action): string {
  return s.assign[a.key] ?? a.owner
}

export type Deliverable = { name: string; due: ISODate; status: "done" | "draft" | "due" | "upcoming" | "overdue"; detail: string; tab: string }

/** The founder-offer deliverables on one calendar, with their real state. */
export function deliverables(c: Client, today: ISODate): Deliverable[] {
  const n = dayN(c, today)
  if (n === null || !c.kickoffDate) return []
  const st = (done: boolean, draft: boolean, due: ISODate): Deliverable["status"] => (done ? "done" : draft ? "draft" : due < today ? "overdue" : diffDays(due, today) <= 7 ? "due" : "upcoming")
  const out: Deliverable[] = []
  for (let w = 1; w <= 13; w++) {
    const fri = fridayOf(dateOfDay(c, w * 7 - 2)!)
    if (diffDays(fri, today) > 14) break
    const sent = c.updatesSent.includes(fri)
    const draft = c.reports.some((r) => r.id === `${c.id}-wpu-${fri}` && r.status !== "sent")
    out.push({ name: `Weekly Progress Update ${w}`, due: fri, status: st(sent, draft, fri), detail: sent ? "Sent" : draft ? "Draft ready" : "Not drafted", tab: "reports" })
  }
  const pub = c.sops.filter((x) => x.status === "published").length
  out.push({ name: "Ops Playbook v1", due: dateOfDay(c, 21)!, status: st(pub >= 4, c.sops.length > 0, dateOfDay(c, 21)!), detail: `${pub} of 4 SOPs published`, tab: "playbook" })
  out.push({ name: "Team Fit Map", due: dateOfDay(c, 21)!, status: st(c.fitPublished, !!c.fitImported, dateOfDay(c, 21)!), detail: c.fitPublished ? "Published" : c.fitImported ? "Imported, not published" : "Survey in progress", tab: "fit" })
  out.push({ name: "Readout with the owner", due: dateOfDay(c, c.readoutDay)!, status: st(c.readoutAttended, false, dateOfDay(c, c.readoutDay)!), detail: c.readoutAttended ? "Held" : "Not held yet", tab: "onboarding" })
  for (const m of [1, 2]) {
    const r = c.reports.find((x) => x.kind === "scorecard" && x.period === `Month ${m}`)
    out.push({ name: `Monthly scorecard ${m}`, due: dateOfDay(c, 30 * m)!, status: st(r?.status === "sent", !!r, dateOfDay(c, 30 * m)!), detail: r ? (r.status === "sent" ? "Sent" : "Draft") : "Not drafted", tab: "reports" })
  }
  const d90 = c.reports.find((x) => x.kind === "day90")
  out.push({ name: "Day-90 report", due: dateOfDay(c, 90)!, status: st(d90?.status === "sent", !!d90, dateOfDay(c, 90)!), detail: d90 ? (d90.status === "sent" ? "Sent" : "Draft") : "Not drafted", tab: "reports" })
  return out.sort((a, b) => a.due.localeCompare(b.due))
}

export function newReport(c: Client, kind: "wpu" | "scorecard" | "ceo" | "day90" | "custom", today: ISODate, request?: string) {
  const n = dayN(c, today) ?? 0
  if (kind === "wpu") return wpuReport(c, fridayOf(today), "draft")
  if (kind === "scorecard") return scorecard(c, Math.max(1, Math.ceil(n / 30)), today, "draft")
  const g = guarantees(c, today)
  const base = { id: `${c.id}-${kind}-${today}-${Math.round(Math.random() * 1e4)}`, status: "draft" as const, created: today, sent: null }
  if (kind === "day90") return { ...base, kind, title: "Day-90 report", period: "Days 0 to 90", summary: `Hours back a week: ${g.back} against the 40-hour guarantee. ${c.agents.filter((a) => agentStatus(a, c, today) === "live").length} agents live. Team on day 0 next to day 90, and the plan for next quarter.` }
  if (kind === "ceo") return { ...base, kind, title: "CEO summary", period: `Day ${n}`, summary: `${g.found} hours a week found, ${g.back} back so far. Top three to automate next and the decisions waiting on the owner.` }
  return { ...base, kind, title: request ? `Request: ${request.slice(0, 48)}` : "Custom report", period: `Day ${n}`, summary: "Requested by the client. Prepared by the Aalpha team, reviewed before it is sent.", request }
}

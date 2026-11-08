// What the 5-minute interview hears, and where each confirmed piece goes. Every answer becomes
// one or more cards (a goal with its number, a workflow drawn as steps, a pain point, a hand-off,
// something never to automate, a note about the role). The person fixes and confirms each card;
// on approval they land in the app with a "From <name>'s interview" tag. Sample answers.

import { hash } from "./dates"
import { homeTeam } from "./teams"
import type { Client, Goal, InterviewSet, ISODate, Seat, Tool } from "./types"

export type CardKind = "Goal" | "Workflow" | "Pain point" | "Hand-off" | "Never automate" | "Role note"
export type Card = { id: string; q: number; kind: CardKind; text: string; quote: string; number?: string; steps?: string[]; tools?: Tool[]; wf?: string; ok?: boolean }

const C = (q: number, kind: CardKind, text: string, quote: string, extra: Partial<Card> = {}): Card => ({ id: `${q}-${kind}-${text.slice(0, 8)}`, q, kind, text, quote, ...extra })

export const CARDS: Record<InterviewSet, Card[]> = {
  Executive: [
    C(0, "Goal", "Revenue per person over $15k a month", "Revenue per head over fifteen grand a month, and churn under 2%.", { number: "$15k" }),
    C(1, "Pain point", "Creative and proposal approvals all wait on me", "Approvals. Creative and proposals all come through me."),
    C(1, "Workflow", "Approving creative", "Creative comes to me in Slack, I read it, send notes, then sign off.", { wf: "Chasing creative approvals", steps: ["Designer posts in #creative", "Review the work", "Send notes in Slack", "Final sign-off"], tools: ["slack", "gmail"] }),
    C(2, "Hand-off", "Budget changes under $2k", "Any spend change over two thousand dollars waits on me. Under that shouldn't.", { wf: "Budget change requests" }),
    C(3, "Goal", "See at-risk clients two weeks earlier", "Which clients are quietly unhappy before they tell us.", { number: "2 weeks" }),
    C(4, "Role note", "Wants freed hours to go into new business", "Into new business and two more retainer clients a month."),
  ],
  Operations: [
    C(0, "Workflow", "New client setup", "Sales hands over in Slack, I set up HubSpot, Drive and Asana, then book the kickoff.", { wf: "New client setup", steps: ["Sales hands over in Slack", "Create the HubSpot company", "Copy the Drive folder", "Create the Asana project", "Book the kickoff"], tools: ["hubspot", "docs", "asana", "gmail"] }),
    C(1, "Pain point", "Creative sign-offs sit a day with account managers", "Creative to account management. Sign-offs sit for a day."),
    C(2, "Workflow", "Timesheet reminders", "Every Friday I chase timesheets one by one.", { wf: "Timesheet reminders", steps: ["Check who hasn't logged time", "DM each person", "Remind again Monday"], tools: ["slack", "gmail"] }),
    C(3, "Goal", "Ops report ready by 9am Monday without me building it", "The weekly ops report, from three spreadsheets. Two hours every Monday.", { number: "2 h" }),
    C(4, "Hand-off", "New client setup", "New client setup. It's the same every time.", { wf: "New client setup" }),
  ],
  Delivery: [
    C(0, "Workflow", "Monthly client reports", "Client reports: I pull GA and HubSpot, paste into Sheets, update the deck and send it.", { wf: "Monthly client reports", steps: ["Pull GA4 and HubSpot", "Paste into the report sheet", "Update the deck", "Send to the client"], tools: ["ga", "hubspot", "sheets", "slides"] }),
    C(1, "Hand-off", "Weekly status updates", "Status updates. I write the same thing three times.", { wf: "Weekly client status updates" }),
    C(2, "Pain point", "Waiting on client creative approvals", "Creative approvals from the client. Sometimes three days."),
    C(3, "Role note", "Works across Google Ads, Sheets, Slack and HubSpot", "Google Ads, Sheets, Slack and HubSpot, all day."),
    C(4, "Never automate", "Changing a client's ad budget", "Anything that changes a client's budget without me checking it.", { wf: "Budget change requests" }),
    C(4, "Goal", "Get 2 more hours of focus time a week", "I'd like a couple of hours a week without pings.", { number: "2 h" }),
  ],
  Sales: [
    C(0, "Workflow", "Lead to signed", "Form fill, I reply, discovery call, proposal, then a follow-up or two.", { wf: "Logging lead follow-ups in CRM", steps: ["Lead fills the form", "First reply", "Discovery call", "Proposal", "Follow-ups"], tools: ["hubspot", "gmail"] }),
    C(1, "Pain point", "Nobody follows up on day 3 after a proposal", "After the proposal. Nobody follows up on day 3."),
    C(2, "Hand-off", "Call notes into HubSpot", "Call notes and deal stages, by hand.", { wf: "Logging lead follow-ups in CRM" }),
    C(3, "Goal", "Proposals done in 30 minutes, not 2 hours", "About two hours, mostly formatting.", { number: "30 min" }),
    C(4, "Hand-off", "Proposal formatting", "Follow-ups, then formatting proposals.", { wf: "Proposal formatting" }),
  ],
}

export function destination(c: Client, s: Seat, set: InterviewSet, k: Card) {
  if (k.kind === "Goal") {
    if (set === "Executive") return "Draft company goal. The owner locks it with Aalpha."
    if (set === "Operations") return `Draft team goal for ${homeTeam(c, s)}. Your manager confirms it.`
    return `Your personal goal, linked to ${parentFor(c, s)?.title ?? "a company goal"}`
  }
  if (k.kind === "Workflow") return c.workflows.some((w) => w.name === k.wf) ? `"Verified by ${s.name.split(" ")[0]}" on Workflows, and it feeds Processes` : "A new workflow for Aalpha to review"
  if (k.kind === "Hand-off") return `A ranked opportunity, tuned to the locked goals${set === "Executive" ? "" : `, and your personal goal "Hand off ${k.text.toLowerCase()}"`}`
  if (k.kind === "Never automate") return "Kept out of opportunities and the Playbook"
  if (k.kind === "Pain point") return "Your summary, and the risks in the Executive report"
  return "Your card on the Fit Map"
}

/** The goal a person's goal points to: their team's goal if there is one, else the first company goal. */
export function parentFor(c: Client, s: Seat): Goal | undefined {
  const t = homeTeam(c, s)
  return c.goals.find((g) => g.level === "team" && g.team === t && g.status === "published") ?? c.goals.find((g) => (g.level ?? "company") === "company" && g.status === "published")
}

export const summaryOf = (cards: Card[]) => {
  const of = (k: CardKind) => cards.filter((x) => x.kind === k).map((x) => x.text.toLowerCase())
  const parts = [["Main work", of("Workflow")], ["Pain points", of("Pain point")], ["Would hand off first", of("Hand-off")], ["Never automate", of("Never automate")]] as const
  return parts.filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join("; ")}.`).join(" ")
}

/** Puts every confirmed card where it belongs and records what was mapped on the person. */
export function applyInterview(c: Client, s: Seat, set: InterviewSet, cards: Card[], today: ISODate): Client {
  const name = s.name
  const tag = `From ${name}'s interview`
  const add = (list: string[] | undefined) => Array.from(new Set([...(list ?? []), name]))
  let goals = [...c.goals]
  let workflows = c.workflows
  let fit = c.fit
  const n = { goals: 0, workflows: 0, handoffs: 0, never: 0, notes: 0 }
  const personal = (title: string, wellbeing = false) => {
    if (goals.some((g) => g.level === "personal" && g.ownerId === s.id && g.title === title) || goals.filter((g) => g.level === "personal" && g.ownerId === s.id).length >= 3) return
    const p = parentFor({ ...c, goals }, s)
    goals.push({ id: `${s.id}-pg${goals.length}`, title, metric: "Hours back a week", target: 2, categories: [], status: "published", level: "personal", parent: p?.id ?? null, ownerId: s.id, wellbeing, source: tag, onTrack: hash(s.id + title) > 0.3 })
    n.goals++
  }
  for (const k of cards) {
    if (k.kind === "Goal") {
      if (set === "Executive" || set === "Operations") {
        const level = set === "Executive" ? "company" : "team"
        const same = goals.find((g) => g.title === k.text)
        if (same) goals = goals.map((g) => (g === same ? { ...g, source: g.source ?? tag } : g))
        else goals.push({ id: `${c.id}-ig${goals.length}`, title: k.text, metric: "Hours back a week", target: Number((k.number ?? "").replace(/[^0-9.]/g, "")) || 5, categories: [], status: "draft", level, team: level === "team" ? homeTeam(c, s) : null, parent: level === "team" ? goals.find((g) => (g.level ?? "company") === "company")?.id ?? null : null, source: tag })
        n.goals++
      } else personal(k.text, /after-hours|evening|weekend/i.test(k.text))
    }
    if (k.kind === "Workflow" && k.wf) { workflows = workflows.map((w) => (w.name === k.wf ? { ...w, verifiedBy: add(w.verifiedBy) } : w)); n.workflows++ }
    if (k.kind === "Hand-off" && k.wf) { workflows = workflows.map((w) => (w.name === k.wf ? { ...w, handoffBy: add(w.handoffBy) } : w)); n.handoffs++; if (set !== "Executive") personal(`Hand off ${k.text.toLowerCase()}`) }
    if (k.kind === "Never automate" && k.wf) { workflows = workflows.map((w) => (w.name === k.wf ? { ...w, neverAutomate: w.neverAutomate ?? { by: name, note: k.text } } : w)); n.never++ }
    if (k.kind === "Role note") { fit = fit.map((f) => (f.seatId === s.id ? { ...f, note: { text: k.text, by: name } } : f)); n.notes++ }
  }
  const pains = cards.filter((k) => k.kind === "Pain point").map((k) => k.text)
  return {
    ...c, goals, workflows, fit,
    seats: c.seats.map((x) => (x.id === s.id ? { ...x, interview: { status: "approved", at: today, role: set, summary: summaryOf(cards), pains, mapped: n } } : x)),
  }
}

// ── sample goals at all three levels ────────────────────────────────────────

const TEAM_GOALS: Record<string, [string, number][]> = {
  // [title, which company goal it serves (index)]
  "Client delivery": [["Reports built in 30 minutes a client", 1]], "Paid media": [["Pacing checked by the agent every morning", 2]],
  Creative: [["Creative approvals back within a day", 3]], "Ops and finance": [["New client set up in under an hour", 0]],
  "SEO and web": [["Rank roundups written by the agent", 1]], Sales: [["Every proposal followed up on day 3", 0]],
  "Retail and DTC pod": [["Monthly reports out by the 3rd", 1]], "B2B and SaaS pod": [["Status updates written once", 0]], "Local and franchise pod": [["Budget changes applied the same day", 2]],
  "Pod A": [["Client reports out by the 3rd", 1]], "Pod B": [["Status updates written once", 0]], "Pod C": [["Creative approvals back within a day", 2]], "Pod D": [["New client set up in under an hour", 0]],
}

/** Team goals for every team, then each finished interview mapped in (personal goals, verified workflows, hand-offs). */
export function withGoalLevels(c: Client, today: ISODate, interviews: boolean): Client {
  const company = c.goals.filter((g) => (g.level ?? "company") === "company")
  const teams = Array.from(new Set([...Object.keys(TEAM_GOALS)].filter((t) => c.seats.some((s) => s.team === t || s.pod === t))))
  let next: Client = { ...c, goals: [...c.goals, ...teams.flatMap((t) => TEAM_GOALS[t].map(([title, i], k) => ({ id: `${c.id}-tg-${t.replace(/[^a-z]+/gi, "")}-${k}`, title, metric: "Hours back a week", target: 4, categories: [], status: "published" as const, level: "team" as const, team: t, parent: company[Math.min(i, company.length - 1)]?.id ?? null, onTrack: hash(c.id + title) > 0.25 })))] }
  for (const s of c.seats) {
    const set = s.interview?.role
    // Each sample person said a slightly different subset, so summaries and credits differ by person.
    if (set && interviews) next = applyInterview(next, next.seats.find((x) => x.id === s.id)!, set, CARDS[set].filter((_, i) => i < 2 || hash(s.id + "k" + i) > 0.4), s.interview!.at)
    else if (!interviews && hash(s.id + "pg") > 0.5) next = applyInterview(next, s, "Delivery", CARDS.Delivery.filter((k) => k.kind === "Hand-off" || k.kind === "Goal"), today)
  }
  // One private wellbeing goal in the demo: only its owner sees it unless they share it.
  const j = next.seats[3]
  if (interviews && j && !next.goals.some((g) => g.ownerId === j.id && g.wellbeing && g.title.startsWith("Fewer"))) next = { ...next, goals: [...next.goals, { id: `${j.id}-wb`, title: "Fewer after-hours messages", metric: "After-hours messages a week", target: 5, categories: [], status: "published", level: "personal", parent: parentFor(next, j)?.id ?? null, ownerId: j.id, wellbeing: true, onTrack: false }] }
  return next
}

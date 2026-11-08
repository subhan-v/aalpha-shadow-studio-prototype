// Sample delivery work for each client: the workflows Shadow finds, the SOPs we
// write from them, goals, the Fit Map and reports. Deterministic per client so a
// reset always gives the same picture. Sample data only.

import { addDays, fmt, hash } from "./dates"
import { suggestFunction } from "./teams"
import type { Category, Client, FitPerson, Goal, ISODate, Report, Sop, SopSection, Tier, Tool, Workflow } from "./types"

type WT = [name: string, raw: string, cat: Category, tier: Tier, people: number, runs: number, avg: number, min: number, max: number, ways: number, hrsWk: number, tools: Tool[]]

const TEMPLATES: WT[] = [
  ["Monthly client reports", "Build monthly performance deck from GA4 + HubSpot exports into Sheets and Slides (versioned)", "Reporting", "H", 7, 24, 90, 45, 190, 5, 10.6, ["ga", "hubspot", "sheets", "slides", "slack", "gmail"]],
  ["Ad spend and pacing checks", "Check spend vs budget across Google Ads accounts, log variances to Sheets, flag in Slack", "Paid media", "H", 6, 140, 18, 9, 41, 3, 7.2, ["gads", "sheets", "slack"]],
  ["Weekly client status updates", "Write status update, cross-post to Slack, email and Asana task (3x duplicate)", "Client delivery", "H", 8, 96, 22, 10, 55, 4, 6.2, ["asana", "slack", "gmail"]],
  ["Rank tracking roundup", "Pull keyword rank changes, summarise movers, paste into client doc", "Reporting", "H", 4, 38, 35, 20, 70, 2, 4.6, ["sheets", "docs", "slack"]],
  ["New client setup", "Create Drive folders, HubSpot company, Asana project and kickoff tasks from checklist", "Ops and admin", "H", 2, 6, 160, 110, 245, 6, 4.2, ["hubspot", "asana", "docs", "gmail"]],
  ["Repeat questions in #ask-ops", "Answer recurring how-do-I questions in #ask-ops from memory or old threads", "Ops and admin", "M", 3, 210, 4, 1, 22, 1, 3.2, ["slack", "docs"]],
  ["Chasing creative approvals", "Follow up on pending creative sign-offs across Slack and email", "Creative", "M", 4, 64, 9, 3, 30, 3, 2.8, ["slack", "gmail"]],
  ["Logging lead follow-ups in CRM", "Copy call and email outcomes into HubSpot deal notes and stages", "Sales", "M", 3, 88, 7, 4, 15, 2, 2.5, ["hubspot", "gmail"]],
  ["Budget change requests", "Collect client budget changes, apply in Google Ads, confirm in Slack", "Paid media", "M", 5, 42, 14, 8, 26, 3, 2.3, ["gads", "slack", "gmail"]],
  ["Matching invoices to time", "Reconcile invoices against tracked time in Sheets", "Ops and admin", "M", 1, 4, 185, 160, 210, 2, 2.1, ["sheets", "gmail"]],
  ["Client QA checklists", "Run pre-launch QA checklist and post results", "Client delivery", "M", 6, 58, 12, 7, 20, 2, 1.8, ["docs", "asana"]],
  ["Report screenshot cleanup", "Crop and annotate dashboard screenshots for decks", "Reporting", "L", 5, 30, 11, 6, 25, 2, 1.4, ["slides"]],
  ["Social post scheduling", "Copy approved posts into scheduler and confirm in Slack", "Creative", "L", 3, 70, 6, 4, 10, 1, 1.6, ["sheets", "slack"]],
  ["Proposal formatting", "Reformat proposal drafts into the template", "Sales", "L", 2, 9, 48, 30, 75, 3, 1.2, ["docs"]],
  ["Expense receipts", "Forward and file expense receipts", "Ops and admin", "L", 8, 40, 5, 3, 9, 1, 1.2, ["gmail", "sheets"]],
  ["Standup notes", "Write daily standup notes in Slack", "Client delivery", "L", 8, 60, 6, 3, 12, 2, 0.9, ["slack"]],
  ["UTM link building", "Build tagged links for campaigns in Sheets", "Paid media", "L", 3, 35, 4, 2, 8, 1, 0.7, ["sheets"]],
]
const TEMPLATE_HRS = TEMPLATES.reduce((s, t) => s + t[10], 0)

export function makeWorkflows(c: Pick<Client, "id" | "foundTarget">, publishedUpTo: number): Workflow[] {
  const k = c.foundTarget / TEMPLATE_HRS
  return TEMPLATES.map((t, i) => {
    const day = Math.min(14, 3 + Math.floor(i * 0.7))
    const j = 0.85 + hash(c.id + i) * 0.3
    return {
      id: `${c.id}-w${i + 1}`, name: t[0], rawName: t[1], category: t[2], tier: t[3],
      people: t[4], runs: Math.round(t[5] * j), avgMin: t[6], minMin: t[7], maxMin: t[8], ways: t[9],
      hoursWk: Math.round(t[10] * k * 10) / 10, tools: t[11], discoveredDay: day,
      review: day <= publishedUpTo ? "published" : "new", mergedInto: null,
    }
  })
}

// ── SOP step banks ──────────────────────────────────────────────────────────

type S = [Tool, string, string, string, number, boolean, string?]
const BANK: Record<string, { name: string; role: string; steps: S[] }[]> = {
  "Monthly client reports": [
    { name: "Pull the numbers", role: "Account manager", steps: [
      ["ga", "Open the client’s property and click", "Reports", "in the left menu.", 3, false],
      ["ga", "Set the date range to", "Last month", "and click Apply.", 1, true],
      ["hubspot", "Open the", "Client leads", "dashboard under Reporting.", 2, true],
      ["hubspot", "Click", "Export", "and choose CSV.", 1, true],
    ] },
    { name: "Build the report", role: "Account manager", steps: [
      ["sheets", "Paste both exports into the", "Data", "tab of the client’s report sheet.", 6, true],
      ["slides", "Open last month’s deck and click", "File › Make a copy", "", 2, false, "Name the copy “Client name, Month Year” so search finds it."],
      ["slides", "Update the six headline numbers from the", "Summary", "tab.", 30, true],
    ] },
    { name: "Check and send", role: "Account lead", steps: [
      ["slack", "Post the deck in", "#client-reports", "and tag the account lead to check it.", 3, false],
      ["gmail", "Send the link to the client with the", "Monthly report", "template.", 4, false],
    ] },
  ],
  "Ad spend and pacing checks": [
    { name: "Check pacing", role: "Media buyer", steps: [
      ["gads", "Open the account and switch the view to", "Campaigns", "for this month.", 2, true],
      ["gads", "Sort by", "Cost", "and compare against the monthly budget.", 4, true],
      ["sheets", "Log any campaign over 10% off pace in the", "Pacing", "tab.", 6, true],
    ] },
    { name: "Flag and fix", role: "Media buyer", steps: [
      ["slack", "Post the variances in", "#paid-media", "with the account name.", 2, false],
      ["gads", "Adjust daily budgets and click", "Save", "", 4, false],
    ] },
  ],
  "Weekly client status updates": [
    { name: "Write it once", role: "Account manager", steps: [
      ["asana", "Open the client project and filter to", "Completed this week", "", 3, true],
      ["docs", "Fill in the", "Weekly update", "template with wins, next steps and blockers.", 10, true],
    ] },
    { name: "Send it", role: "Account manager", steps: [
      ["slack", "Post the update in the client’s", "shared channel", "", 2, true],
      ["gmail", "Email the same update with the", "Weekly status", "template.", 3, true],
      ["asana", "Paste the link into the", "Status", "field.", 2, true],
    ] },
  ],
  "Meeting notes to tasks": [
    { name: "After the call", role: "Account manager", steps: [
      ["docs", "Open the call notes in the client’s", "Meetings", "folder.", 2, false],
      ["asana", "Create a task for each action item with", "Add task", "and set the owner.", 6, true],
      ["asana", "Set due dates from the", "Next steps", "list in the notes.", 2, true],
    ] },
    { name: "Recap", role: "Account manager", steps: [
      ["gmail", "Send the recap with the", "Call recap", "template.", 3, true],
      ["slack", "Post the task links in the client’s", "internal channel", "", 1, true],
    ] },
  ],
  "Chasing creative approvals": [
    { name: "Find what is waiting", role: "Designer", steps: [
      ["slack", "Search", "#creative", "for posts marked Waiting on client.", 2, true],
      ["docs", "Check the", "Approvals", "tracker for anything older than two days.", 2, true],
    ] },
    { name: "Nudge and log", role: "Designer", steps: [
      ["gmail", "Send the reminder with the", "Approval nudge", "template.", 2, true, "One reminder a day at most. A second one goes to the account manager."],
      ["docs", "Mark the date in the", "Last nudged", "column.", 1, true],
    ] },
  ],
  "New client setup": [
    { name: "Records", role: "Ops", steps: [
      ["hubspot", "Create the company and click", "Associate deal", "", 8, true],
      ["docs", "Copy the", "Client folder template", "into Drive and rename it.", 6, true],
    ] },
    { name: "Kickoff", role: "Ops", steps: [
      ["asana", "Create the project from the", "Onboarding", "template.", 10, true],
      ["gmail", "Send the welcome email with the", "Kickoff", "template.", 5, false],
      ["slack", "Create", "#client-shared", "and invite the client.", 6, false],
    ] },
  ],
}

export function draftSop(c: Pick<Client, "id">, w: Workflow, today: ISODate, status: Sop["status"] = "draft", ownerName = "Team lead"): Sop {
  const bank = BANK[w.name] ?? [
    { name: "Do the work", role: "Owner of the task", steps: w.tools.map((t, i) => [t, i === 0 ? "Open" : "Then use", TOOL_NAME[t], i === w.tools.length - 1 ? "to finish and share." : "for the next part.", Math.max(2, Math.round(w.avgMin / w.tools.length)), i > 0] as S) },
  ]
  let n = 0
  const sections: SopSection[] = bank.map((sec, si) => ({
    id: `${w.id}-s${si}`, name: sec.name, role: sec.role,
    steps: sec.steps.map((s) => ({ id: `${w.id}-st${n++}`, tool: s[0], before: s[1], label: s[2], after: s[3], mins: s[4], auto: s[5], tip: s[6] })),
  }))
  return { id: `${w.id}-sop`, workflowId: w.id, title: titleFor(w.name), owner: ownerName, version: status === "published" ? 2 : 1, checked: status === "published" ? addDays(today, -3) : null, status, sections }
}

function titleFor(name: string) {
  const map: Record<string, string> = {
    "Monthly client reports": "Build the monthly client report",
    "Ad spend and pacing checks": "Check ad spend and pacing",
    "Weekly client status updates": "Send the weekly client update",
    "New client setup": "Set up a new client",
    "Meeting notes to tasks": "Turn meeting notes into tasks",
    "Chasing creative approvals": "Chase creative approvals",
  }
  return map[name] ?? name
}

export const TOOL_NAME: Record<Tool, string> = {
  ga: "Google Analytics", gads: "Google Ads", hubspot: "HubSpot", sheets: "Google Sheets", slides: "Google Slides", docs: "Google Docs", slack: "Slack", gmail: "Gmail", asana: "Asana",
}
export const toolIcon = (t: Tool) => `/icons/${t}.png`

// ── goals ───────────────────────────────────────────────────────────────────

export function makeGoals(c: Pick<Client, "id">, status: Goal["status"]): Goal[] {
  return [
    { id: `${c.id}-g1`, title: "Take on 5 more clients without hiring", metric: "Hours back a week", target: 40, categories: ["Reporting", "Paid media", "Client delivery", "Ops and admin", "Creative", "Sales"], status },
    { id: `${c.id}-g2`, title: "Cut reporting time in half", metric: "Reporting hours back a week", target: 8, categories: ["Reporting"], status },
    { id: `${c.id}-g3`, title: "Get the founder out of approvals", metric: "Approval hours back a week", target: 5, categories: ["Creative", "Ops and admin"], status },
  ]
}

// ── Fit Map ─────────────────────────────────────────────────────────────────

const PROFILES = ["Driver", "Connector", "Analyst", "Specialist"] as const

export function makeFit(c: Pick<Client, "id" | "seats">): FitPerson[] {
  const leads: Record<string, string> = {}
  const people: FitPerson[] = c.seats.map((s) => {
    const team = s.team ?? suggestFunction(s.role)
    const isLead = !leads[team]
    if (isLead) leads[team] = s.id
    const h = hash(s.id)
    return {
      seatId: s.id, team,
      profile: s.ciSurvey ? PROFILES[Math.floor(hash(s.id + "profile") * 4)] : null,
      fit: s.ciSurvey ? Math.round(55 + hash(s.id + "fit") * 42) : null,
      loadHrs: Math.round(32 + h * 16 + (isLead ? 4 : 0)),
      keyPerson: false,
      reportsTo: isLead ? null : leads[team],
    }
  })
  const top = people.reduce((a, b) => (b.loadHrs > a.loadHrs ? b : a), people[0])
  if (top) top.keyPerson = true
  return people
}

// ── reports ─────────────────────────────────────────────────────────────────

export function wpuReport(c: Pick<Client, "id" | "name">, friday: ISODate, status: Report["status"]): Report {
  return {
    id: `${c.id}-wpu-${friday}`, kind: "wpu", title: "Weekly Progress Update", period: `Week ending ${fmt(friday)}`, status, created: addDays(friday, -1), sent: status === "sent" ? friday : null,
    summary: `This week at ${c.name}: new workflows reviewed and published, the next agents moved forward, and who is recording. The full numbers are in the update.`,
  }
}

export function scorecard(c: Pick<Client, "id" | "name">, month: number, date: ISODate, status: Report["status"]): Report {
  return {
    id: `${c.id}-sc${month}`, kind: "scorecard", title: `Monthly scorecard, month ${month}`, period: `Month ${month}`, status, created: date, sent: status === "sent" ? date : null,
    summary: `Hours back against the day-0 baseline, agents live, AI spend and what we build next month.`,
  }
}

// Larkspur Agency: the sample client for sales demos. A made-up 32-person agency on day 45
// of 90, tuned so every client-app tab is full and the numbers agree with each other:
// about 800 opportunity hours a month, nine agents live, goals locked, Playbook and Fit Map
// published. Labelled as sample wherever it shows. Names and numbers are invented.

import { addDays } from "./dates"
import { draftSop, makeFit, wpuReport } from "./delivery"
import { CAT_FN, suggestFunction } from "./teams"
import { bigChannelList, CATALOG, interviewSetFor } from "./setup"
import { hash } from "./dates"
import type { Agent, Category, Client, ISODate, Report, Seat, Tier, Tool, Workflow } from "./types"
import { APP } from "@/lib/flags"

const PEOPLE: [name: string, role: string][] = [
  ["Dana Whitfield", "CEO"], ["Marcus Reed", "COO"], ["Priya Shah", "Account director"],
  ["Jordan Ellis", "Account manager"], ["Sofia Marin", "Account manager"], ["Kevin Okafor", "Account manager"], ["Hannah Cole", "Account manager"],
  ["Luis Ortega", "Account manager"], ["Amara Diallo", "Account manager"], ["Ben Foster", "Account manager"],
  ["Tasha Grant", "Media buyer"], ["Ryan Patel", "Media buyer"], ["Elena Novak", "Media buyer"], ["Chris Duarte", "Media buyer"],
  ["Mei Lin", "PPC analyst"], ["Adam Brooks", "PPC analyst"], ["Nadia Haddad", "PPC analyst"],
  ["Owen Clarke", "SEO specialist"], ["Leila Farah", "SEO specialist"], ["Sam Turner", "SEO specialist"],
  ["Grace Kim", "Content writer"], ["Theo Wright", "Content writer"], ["Ivy Collins", "Content writer"],
  ["Mateo Silva", "Designer"], ["Zoe Bennett", "Designer"], ["Jamal Price", "Designer"], ["Clara Weiss", "Designer"],
  ["Felix Moreno", "Video editor"], ["Rosa Jimenez", "Ops"], ["Ethan Moss", "Ops"], ["Nora Quinn", "Sales lead"], ["Isaac Hale", "Sales lead"],
]

// Loaded $ an hour from payroll (salary plus taxes and benefits).
const PAY: Record<string, number> = {
  CEO: 150, COO: 85, "Account director": 70, "Account manager": 48, "Media buyer": 55, "PPC analyst": 52, "SEO specialist": 46,
  "Content writer": 42, Designer: 46, "Video editor": 44, Ops: 40, "Sales lead": 60,
}

// Larkspur runs by function by default. Its three pods are set up too, so the Organization
// setting can switch the demo to pods or hybrid. Client names are made up.
const PODS: { name: string; lead: number; clients: string[] }[] = [
  { name: "Retail and DTC pod", lead: 3, clients: ["Fernwood", "Kestrel Foods", "Bramble & Co", "Northgate Outdoors"] },
  { name: "B2B and SaaS pod", lead: 4, clients: ["Ledgerline", "Quanta HR", "Brightwater"] },
  { name: "Local and franchise pod", lead: 5, clients: ["Oakridge Dental", "Summit Roofing", "Lakeview Fitness"] },
]
const HEADS: Record<string, number> = { "Client delivery": 2, "Paid media": 10, "SEO and web": 17, Creative: 23, Sales: 0, "Ops and finance": 1 }

type W = [name: string, raw: string, cat: Category, tier: Tier, people: number, runs: number, avg: number, min: number, max: number, ways: number, hrsWk: number, tools: Tool[]]

// Hours back a week stay below the time each workflow takes today (runs x average).
const WORKFLOWS: W[] = [
  ["Monthly client reports", "Build monthly performance deck from GA4 + HubSpot exports into Sheets and Slides (versioned)", "Reporting", "H", 9, 48, 95, 45, 195, 5, 32.5, ["ga", "hubspot", "sheets", "slides", "slack", "gmail"]],
  ["Ad spend and pacing checks", "Check spend vs budget across Google Ads accounts, log variances to Sheets, flag in Slack", "Paid media", "H", 7, 460, 9, 4, 26, 3, 27, ["gads", "sheets", "slack"]],
  ["Weekly client status updates", "Write status update, cross-post to Slack, email and Asana task (3x duplicate)", "Client delivery", "H", 10, 176, 16, 8, 42, 4, 21, ["asana", "slack", "gmail"]],
  ["Chasing creative approvals", "Follow up on pending creative sign-offs across Slack and email", "Creative", "H", 6, 160, 7, 2, 28, 3, 13.5, ["slack", "gmail"]],
  ["Meeting notes to tasks", "Turn client call notes into Asana tasks and a recap email", "Client delivery", "H", 12, 150, 14, 6, 35, 4, 13, ["docs", "asana", "gmail"]],
  ["Rank tracking roundup", "Pull keyword rank changes, summarise movers, paste into client doc", "Reporting", "H", 4, 76, 22, 12, 48, 2, 11, ["sheets", "docs", "slack"]],
  ["New client setup", "Create Drive folders, HubSpot company, Asana project and kickoff tasks from checklist", "Ops and admin", "H", 3, 8, 170, 110, 245, 6, 9, ["hubspot", "asana", "docs", "gmail"]],
  ["Repeat questions in #ask-ops", "Answer recurring how-do-I questions in #ask-ops from memory or old threads", "Ops and admin", "M", 4, 380, 3.5, 1, 22, 1, 8.5, ["slack", "docs"]],
  ["Matching invoices to time", "Reconcile invoices against tracked time in Sheets", "Ops and admin", "M", 2, 6, 180, 150, 220, 2, 7, ["sheets", "gmail"]],
  ["Client QA checklists", "Run pre-launch QA checklist and post results", "Client delivery", "M", 7, 96, 11, 6, 22, 2, 6.5, ["docs", "asana"]],
  ["Creative brief intake", "Copy client requests from email and Slack into the brief template", "Creative", "M", 5, 48, 20, 10, 40, 3, 6, ["gmail", "slack", "docs"]],
  ["Logging lead follow-ups in CRM", "Copy call and email outcomes into HubSpot deal notes and stages", "Sales", "M", 3, 140, 6, 3, 14, 2, 5.5, ["hubspot", "gmail"]],
  ["Budget change requests", "Collect client budget changes, apply in Google Ads, confirm in Slack", "Paid media", "M", 6, 70, 12, 6, 26, 3, 5.5, ["gads", "slack", "gmail"]],
  ["Proposal formatting", "Reformat proposal drafts into the template", "Sales", "M", 3, 14, 45, 30, 75, 3, 4, ["docs"]],
  ["Standup notes", "Write daily standup notes in Slack", "Client delivery", "L", 14, 140, 5, 2, 12, 2, 3.6, ["slack"]],
  ["Social post scheduling", "Copy approved posts into scheduler and confirm in Slack", "Creative", "L", 3, 140, 4, 2, 9, 1, 3.5, ["sheets", "slack"]],
  ["Report screenshot cleanup", "Crop and annotate dashboard screenshots for decks", "Reporting", "L", 5, 60, 9, 4, 22, 2, 3.4, ["slides"]],
  ["Expense receipts", "Forward and file expense receipts", "Ops and admin", "L", 12, 70, 4, 2, 9, 1, 3, ["gmail", "sheets"]],
  ["Onboarding questionnaire chases", "Remind new clients to finish the onboarding questionnaire", "Client delivery", "L", 4, 30, 15, 6, 30, 2, 3, ["gmail", "slack"]],
  ["UTM link building", "Build tagged links for campaigns in Sheets", "Paid media", "L", 4, 60, 4, 2, 8, 1, 1.6, ["sheets"]],
  ["Timesheet reminders", "Chase missing timesheets every Friday", "Ops and admin", "L", 2, 20, 10, 5, 18, 1, 1.4, ["slack", "gmail"]],
]

// [name, baseline h/wk, planned live day, share of the baseline it takes back, the work it takes over]
const AGENTS: [string, number, number, number, Category][] = [
  ["Client report drafts", 29, 12, 0.75, "Reporting"],
  ["Ad spend pacing check", 27, 16, 0.75, "Paid media"],
  ["Status update written once", 19, 22, 0.7, "Client delivery"],
  ["Meeting notes to tasks", 13, 27, 0.7, "Client delivery"],
  ["Repeat questions answered from docs", 8.5, 30, 0.8, "Ops and admin"],
  ["Creative approval reminders", 13.5, 34, 0.7, "Creative"],
  ["Rank tracking roundup", 11, 38, 0.75, "Reporting"],
  ["New client setup", 9, 41, 0.7, "Ops and admin"],
  ["Invoice to time matching", 7, 44, 0.75, "Ops and admin"],
  ["Lead follow-up logging", 5.5, 52, 0.7, "Sales"],
  // Budget changes stay with people: a media buyer said never to automate them in their interview.
  ["Onboarding questionnaire chases", 3, 60, 0.6, "Client delivery"],
  ["Client QA checklist", 6.5, 68, 0.5, "Client delivery"],
  ["Creative brief intake", 6, 74, 0.6, "Creative"],
  ["Social post scheduling", 3.5, 80, 0.7, "Creative"],
]

export const DEMO_ID = "larkspur"
const ALL_CLIENTS = PODS.flatMap((p) => p.clients)

export function demoClient(t: ISODate): Client {
  const kickoff = addDays(t, -45)
  const id = DEMO_ID
  const seats: Seat[] = PEOPLE.map(([name, role], i) => ({
    id: `${id}-s${i + 1}`, name, role, installAt: addDays(kickoff, i % 4 === 3 ? 1 : 0), consent: true,
    // Two people never took the Culture Intelligence survey, so the Fit Map shows the gap honestly.
    ciSurvey: i !== 26 && i !== 30,
    exec: i < 2,
    team: suggestFunction(role),
    pod: PODS[i % 3].name,
    // A few real-life states for the Team page: paused, paused too long, gone quiet, on leave, permissions missing.
    ...(i === 12 ? { pausedFrom: addDays(t, -1) } : {}),
    ...(i === 21 ? { pausedFrom: addDays(t, -6) } : {}),
    ...(i === 16 ? { silentFrom: addDays(t, -4), silentTo: null } : {}),
    ...(i === 24 ? { away: "leave" as const } : {}),
    ...(i === 30 ? { permissions: false } : {}),
    // Everyone has done the 5-minute interview except three people, so the Team page shows who is left.
    interview: [26, 29, 30].includes(i) ? null : { status: "approved" as const, at: addDays(kickoff, 2 + (i % 5)), role: interviewSetFor({ id: "", name, role, installAt: null, consent: true, ciSurvey: true, exec: i < 2 }) },
  }))
  const workflows: Workflow[] = WORKFLOWS.map((w, i) => ({
    id: `${id}-w${i + 1}`, name: w[0], rawName: w[1], category: w[2], tier: w[3], people: w[4], runs: w[5], avgMin: w[6], minMin: w[7], maxMin: w[8], ways: w[9],
    hoursWk: w[10], tools: w[11], discoveredDay: Math.min(14, 3 + Math.floor(i * 0.6)), review: "published", mergedInto: null,
    clients: ["Client delivery", "Paid media", "SEO and web"].includes(CAT_FN[w[2]]) ? ALL_CLIENTS.filter((n) => hash(n + w[0]) > 0.45) : [],
  }))
  const agents: Agent[] = AGENTS.map(([name, base, day, pct, category], i) => ({ id: `${id}-a${i + 1}`, name, baselineHrsWk: base, plannedLiveDay: day, savesPct: pct, category, linear: `LAR-${12 + i * 3}`, manual: "approved" as const }))
  const owner = (role: string) => seats.find((s) => s.role === role)!.name
  const sopFor: [string, string][] = [
    ["Monthly client reports", owner("Account director")], ["Ad spend and pacing checks", "Tasha Grant"], ["Weekly client status updates", "Jordan Ellis"],
    ["Meeting notes to tasks", "Sofia Marin"], ["Chasing creative approvals", "Mateo Silva"], ["New client setup", "Rosa Jimenez"],
  ]
  const sops = sopFor.map(([wn, who]) => draftSop({ id }, workflows.find((w) => w.name === wn)!, t, "published", who))
  const fit = makeFit({ id, seats }).map((f) => {
    const s = seats.find((x) => x.id === f.seatId)!
    return { ...f, team: s.team!, keyPerson: false }
  })
  // Leads report to the CEO; everyone else to their team lead (first seat of the team).
  const leads: Record<string, string> = {}
  for (const f of fit) {
    // Team leads report to the CEO; everyone else to their team lead.
    if (f.seatId === `${id}-s1`) f.reportsTo = null
    else if (!leads[f.team]) { leads[f.team] = f.seatId; f.reportsTo = `${id}-s1` } else f.reportsTo = leads[f.team]
  }
  const priya = fit.find((f) => f.seatId === `${id}-s3`)!
  priya.loadHrs = 52
  priya.keyPerson = true
  fit.find((f) => f.seatId === `${id}-s11`)!.loadHrs = 47

  const fridays = [7, 14, 21, 28, 35, 42].map((d) => addDays(kickoff, d))
  const wpu: string[] = [
    `All 32 people installed within 48 hours and everyone is recording. ${APP} has six days of data. The early leaders are monthly client reports and ad pacing checks. Next week: the first workflow review with Priya.`,
    "184 hours a week of repeat work found across 21 workflows. Client report drafts went live on day 12: 21.8 hours a week back already. Ad pacing checks go live on day 16.",
    "Readout held with Dana and Marcus, and 14 agents approved in priority order. 42 hours a week back, past the 40-hour day-90 guarantee in week three.",
    "Status updates are now written once, and meeting notes turn into tasks on their own. 64.4 hours a week back. Playbook v1 is out with six SOPs.",
    "Month 1 scorecard sent. Repeat questions and creative approval reminders are live, so 80.6 hours a week are back. The Team Fit Map is published from Culture Intelligence.",
    "Rank tracking and new client setup are live. 95.2 hours a week back. Invoice to time matching goes live Monday.",
  ]
  const reports: Report[] = [
    ...fridays.map((f, i) => ({ ...wpuReport({ id, name: "Larkspur" }, f, "sent"), summary: wpu[i] })).reverse(),
    { id: `${id}-custom-1`, kind: "custom", title: "Why do client reports take so long?", period: "Day 24", status: "sent", created: addDays(kickoff, 23), sent: addDays(kickoff, 24), request: "Why do client reports take so long?",
      summary: "Each monthly report touches six tools and gets built five different ways. The fastest way takes 45 minutes and the slowest over three hours. Most of the gap is copying numbers into slides by hand, which the report drafts agent now does." },
    { id: `${id}-sc1`, kind: "scorecard", title: "Monthly scorecard, month 1", period: "Month 1", status: "sent", created: addDays(kickoff, 30), sent: addDays(kickoff, 31),
      summary: "Day 30: 184 hours a week found against the 40-hour guarantee, and 5 agents live giving back 71.2 hours a week. Next month: creative approvals, rank tracking, new client setup and invoices." },
    { id: `${id}-ceo-1`, kind: "ceo", title: "Readout summary", period: "Day 21", status: "sent", created: addDays(kickoff, 21), sent: addDays(kickoff, 21),
      summary: "Reporting and paid media are 45% of the repeat work. Dana approved 14 agents in priority order, starting with report drafts and pacing checks. Decisions waiting on Dana: who owns creative sign-off, and whether Priya hands two accounts to Jordan." },
  ]
  return {
    id, name: "Larkspur Agency", demo: true, owner: "Subhan", plan: "upfront",
    signedDate: addDays(kickoff, -4), kickoffBooked: kickoff, kickoffDate: kickoff,
    agreementSigned: true, paymentIn: true, baselineSigned: kickoff, goalsCaptured: true, slackConnected: true,
    viktorAccess: addDays(kickoff, 3), readoutDay: 21, readoutAttended: true, day90Attended: false, usagePct: 78,
    foundTarget: 184, costPerSeatDay: 1.85,
    seats, agents, pauses: [], updatesSent: fridays, workflowsPublished: true, renewalOpened: false,
    linearKey: "LAR", slackSlug: "larkspur",
    access: Object.fromEntries(seats.map((x, i) => [x.id, i === 0 ? "Owner" : i < 3 ? "Manager" : "Member"])),
    capture: {
      allowApps: ["Google Chrome", "Slack", "Figma", "Google Sheets", "Asana", "Zoom"], allowDomains: ["ads.google.com", "analytics.google.com", "app.hubspot.com", "docs.google.com", "app.asana.com"],
      blockApps: ["1Password", "Messages", "FaceTime"], blockDomains: ["*.bank.com", "chase.com", "healthcare.gov"],
      days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00", mode: "continuous", membersCanPause: true, membersCanBlock: true, preset: "work",
    },
    connections: { slackChannels: bigChannelList(ALL_CLIENTS), autoNewChannels: true, channelExclude: ["random", "social", "birthdays", "pto"], calendar: true, hubspot: true, callNotes: true, payroll: "api" },
    connectors: CATALOG.flatMap((g) => g.items.map((it) => {
      const on = ["Fathom", "HubSpot", "Gmail", "Google Calendar", "Bank feed (read-only)"].includes(it.name)
      return { id: `${id}-${it.name}`, group: g.group, name: it.name, on, by: on ? (it.name === "Gmail" ? "Marcus Reed" : "Dana Whitfield") : null, at: on ? addDays(kickoff, 1) : null, scope: it.ownerOnly ? ["Ops and finance"] : it.name === "Fathom" ? ["Client delivery", "Sales"] : ("company" as const) }
    })),
    reportDelivery: { cadence: "weekly", time: "08:00" },
    pay: Object.fromEntries(seats.map((x) => [x.id, PAY[x.role] ?? 45])),
    paySrc: Object.fromEntries(seats.map((x) => [x.id, "Payroll" as const])),
    prefs: Object.fromEntries(seats.map((x) => [x.id, { pausedUntil: null, start: null, end: null, block: [], allow: [], checklist: ["complete", "allow", "faq", "teamlist", "teamsched", "schedule"] }])),
    schedules: { [`${id}-s1`]: { days: [1, 2, 3, 4, 5, 6, 7], start: "00:00", end: "23:59", preset: "247" } },
    ci: { connected: true, lastSync: addDays(t, -2), invitesSent: kickoff, surveyLink: "https://survey.cultureintelligence.ai/a/larkspur-7k2q9", postedTo: "#larkspur-shadow" },
    workflows, sops,
    goals: [
      { id: `${id}-g1`, title: "Take on 15 more clients without hiring", metric: "Hours back a week", target: 90, categories: ["Reporting", "Client delivery", "Ops and admin", "Paid media", "Creative", "Sales"], status: "published", priority: "High" },
      { id: `${id}-g2`, title: "Cut reporting time in half", metric: "Reporting hours back a week", target: 22, categories: ["Reporting"], status: "published", priority: "High" },
      { id: `${id}-g3`, title: "Stop paid media fire drills", metric: "Paid media hours back a week", target: 16, categories: ["Paid media"], status: "published", priority: "Medium" },
      { id: `${id}-g4`, title: "Get Dana out of creative approvals", metric: "Approval hours back a week", target: 8, categories: ["Creative"], status: "published", priority: "Medium" },
    ],
    business: {
      offer: "Paid media and SEO retainers for DTC, B2B and local brands",
      pricing: "$6k to $15k a month per client, 3-month minimum",
      pods: [
        { name: "Retail and DTC pod", people: 11, clients: 15, revenueMo: 124000 },
        { name: "B2B and SaaS pod", people: 11, clients: 12, revenueMo: 108000 },
        { name: "Local and franchise pod", people: 10, clients: 13, revenueMo: 81000 },
      ],
      execRate: 150, ownerValue: 400, targetMargin: 25,
      otherCompanies: [{ name: "Larkspur Labs (Dana's software side project)", sources: ["larkspurlabs.slack.com", "app.larkspurlabs.io", "github.com/larkspur-labs"] }],
    },
    agentFeedback: [
      { id: `${id}-fb1`, agentId: `${id}-a3`, at: addDays(t, -2), who: "Sofia Marin", source: "Slack", text: "The status update for Fernwood repeated last week's wins.", status: "Open" },
      { id: `${id}-fb2`, agentId: `${id}-a2`, at: addDays(t, -9), who: "Tasha Grant", source: "Client app", text: "Flagged a paused campaign as underspending.", status: "Resolved" },
    ],
    org: "function",
    pods: PODS.map((p) => ({ name: p.name, lead: `${id}-s${p.lead + 1}`, clients: p.clients })),
    funcHeads: Object.fromEntries(Object.entries(HEADS).map(([k, i]) => [k, `${id}-s${i + 1}`])),
    viewTeams: { [`${id}-s2`]: ["Client delivery"] },
    teamsConfirmed: addDays(kickoff, 1),
    goalLock: { locked: true, by: "Dana Whitfield", at: addDays(kickoff, 5), pending: null },
    fit, fitPublished: true, fitImported: addDays(kickoff, 30), reports,
    log: [
      { date: addDays(t, -1), text: "Invoice to time matching is live. 100.4 h/wk back." },
      { date: addDays(t, -3), text: "Weekly Progress Update 6 sent: 95.2 h/wk back." },
      { date: addDays(kickoff, 30), text: "Repeat questions answered from docs is live." },
      { date: addDays(kickoff, 31), text: "Month 1 scorecard sent. Team Fit Map published." },
      { date: addDays(kickoff, 30), text: "Day-30 guarantee met: 184 h/wk found, first agent live day 12." },
      { date: addDays(kickoff, 21), text: "Readout held with Dana and Marcus. 14 agents approved." },
      { date: addDays(kickoff, 5), text: "Goals locked by Dana Whitfield." },
      { date: addDays(kickoff, 2), text: "All 32 computers installed inside the 48-hour window." },
      { date: kickoff, text: "Kickoff held. 48-hour install clock started." },
    ],
  }
}

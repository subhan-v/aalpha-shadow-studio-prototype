import { pilot, PILOT_REQUESTS } from "@/lib/pilot"
import { SEQUENCE } from "./onboarding"
import { demoClient } from "./demo"
import { surveyLink } from "./setup"
import { withGoalLevels } from "./interview"
import { addDays, fridayOf } from "./dates"
import { draftSop, makeFit, makeGoals, makeWorkflows, scorecard, wpuReport } from "./delivery"
import { dateOfDay } from "./engine"
import { sampleRenewed } from "./renewal"
import { sampleBugs } from "./bugs"
import { ROLE_CATS } from "./roles"

import type { Agent, Category, Client, ISODate, Member, Seat, Settings, State } from "./types"
import { APP } from "@/lib/flags"

export type Base = Omit<Client, "workflows" | "sops" | "goals" | "fit" | "fitPublished" | "fitImported" | "reports" | "access" | "capture" | "connections" | "pay" | "prefs" | "schedules" | "ci">

export const TEAM: Member[] = [
  { id: "subhan", name: "Subhan", role: "Founder", email: "subhan@aalpha.ai", access: "Admin" },
  { id: "spec", name: "AI specialist", role: "Delivery (open seat)", email: "delivery@aalpha.ai", access: "Specialist" },
  { id: "hashim", name: "Hashim", role: "CTO", email: "hashim@aalpha.ai", access: "Admin" },
  { id: "salman", name: "Salman", role: "Client success", email: "salman@aalpha.ai", access: "Specialist" },
  { id: "advisor", name: "Board advisor", role: "Advisor", email: "advisor@aalpha.ai", access: "Viewer" },
]

export const DEFAULT_SETTINGS: Settings = { seatFloor: 15, silentHours: 2, uploadDropPct: 50, failurePct: 5, queueHours: 24, costSpikeX: 2, costTargetMax: 2 }

type Opts = { payroll?: "none" | "csv" | "api"; published?: number; sops?: "none" | "draft" | "published"; goals?: "none" | "draft" | "published"; fit?: "none" | "imported" | "published"; scorecards?: number }

/** Adds the delivery work (workflows, SOPs, goals, Fit Map, reports) to a client. */
export function enrich(b: Base, today: ISODate, o: Opts = {}): Client {
  const wf = makeWorkflows(b, o.published ?? 0)
  const top = wf.filter((w) => w.tier === "H").slice(0, 4)
  const sops = o.sops === "published" ? top.map((w) => draftSop(b, w, today, "published")) : o.sops === "draft" ? top.slice(0, 2).map((w) => draftSop(b, w, today, "draft")) : []
  const fitImported = o.fit && o.fit !== "none" ? addDays(today, -7) : null
  const reports = [
    ...b.updatesSent.map((f) => wpuReport(b, f, "sent")),
    ...Array.from({ length: o.scorecards ?? 0 }, (_, i) => scorecard(b, i + 1, addDays(b.kickoffDate ?? today, 30 * (i + 1)), "sent")),
  ]
  const RATE: Record<string, number> = { CEO: 250, COO: 90, "Account manager": 34, "Media buyer": 40, "SEO specialist": 32, Designer: 30, "Content writer": 28, Ops: 30, "PPC analyst": 38, "Video editor": 32, CSM: 35, "Ads manager": 45, "Sales lead": 55 }
  return {
    ...b,
    access: Object.fromEntries(b.seats.map((x, i) => [x.id, i === 0 ? "Owner" : i < 3 ? "Manager" : "Member"])),
    capture: { allowApps: [], allowDomains: [], blockApps: ["1Password", "Messages", "FaceTime"], blockDomains: ["mail.google.com/mail/u/1", "*.bank.com", "chase.com", "healthcare.gov"], days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00", mode: "continuous", membersCanPause: true, membersCanBlock: true },
    connections: { slackChannels: ["general", "client-reports", "ask-ops", "paid-media", "creative", "sales", "random"].map((n) => ({ name: n, on: n !== "random" })), calendar: false, hubspot: false, callNotes: false, payroll: o.payroll ?? "none" },
    pay: Object.fromEntries(b.seats.map((x) => [x.id, RATE[x.role] ?? 32])),
    prefs: {},
    schedules: {},
    ci: { connected: true, lastSync: o.fit && o.fit !== "none" ? addDays(today, -1) : null, invitesSent: b.kickoffDate },
    workflows: wf, sops, goals: o.goals && o.goals !== "none" ? makeGoals(b, o.goals) : [],
    fit: makeFit(b), fitPublished: o.fit === "published", fitImported, reports,
  }
}

// Sample agencies only. Names and numbers are made up.
export const SEED_TODAY: ISODate = "2026-10-26"

const FIRST = ["Ana", "Jo", "Rita", "Sam", "Dev", "Priya", "Marco", "Leah", "Omar", "Ines", "Theo", "Kim", "Noor", "Luis", "Maya", "Ravi", "Tess", "Owen", "Zara", "Ken", "Lena", "Hugo", "Iris", "Paolo", "Sara", "Yusuf", "Bea", "Cole", "Dina", "Eli", "Fay"]
const ROLES = ["Account manager", "Media buyer", "SEO specialist", "Designer", "Content writer", "Ops", "PPC analyst"]

function seats(prefix: string, n: number, plan: (i: number) => Partial<Seat>): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-s${i + 1}`,
    name: `${FIRST[(i + prefix.length * 3) % FIRST.length]} ${String.fromCharCode(65 + ((i * 7 + prefix.length) % 26))}.`,
    role: ROLES[i % ROLES.length],
    installAt: null,
    consent: true,
    ciSurvey: true,
    ...plan(i),
  }))
}

const AGENT_NAMES = [
  "Client report drafts", "Status update written once", "New client setup", "Ad spend pacing check",
  "Repeat questions answered from docs", "Creative approval reminders", "Lead follow-up logging",
  "Budget change requests", "Invoice to time matching", "Client QA checklist", "Rank tracking roundup",
  "Proposal formatting", "Standup notes",
]

// The kind of work each sample agent takes over, so its hours land on the people who did that work.
const AGENT_CATS: Category[] = ["Reporting", "Client delivery", "Client delivery", "Paid media", "Client delivery", "Creative", "Sales", "Paid media", "Ops and admin", "Client delivery", "Reporting", "Sales", "Ops and admin"]

export function agents(key: string, plan: [number, number][], extra: Partial<Agent>[] = []): Agent[] {
  return plan.map(([day, base], i) => ({
    id: `${key}-a${i + 1}`,
    name: AGENT_NAMES[i % AGENT_NAMES.length],
    category: AGENT_CATS[i % AGENT_CATS.length],
    baselineHrsWk: base,
    plannedLiveDay: day,
    savesPct: 0.8,
    linear: `${key.toUpperCase()}-${10 + i * 2}`,
    ...(extra[i] ?? {}),
  }))
}

/** What a won deal in the CRM would create. */
export function newClient(o: { name: string; seatCount: number; plan: "upfront" | "monthly"; owner: string; kickoffBooked: ISODate; today: ISODate }): Client {
  const c = enrich(newBase(o), o.today)
  // A new agency gets its own Culture Intelligence survey link, posted to its Slack channel.
  const link = surveyLink(c)
  return { ...c, ci: { ...c.ci, surveyLink: link, postedTo: `#${c.slackSlug}-shadow` }, log: [{ date: o.today, text: `Culture Intelligence survey link created and posted to #${c.slackSlug}-shadow.` }, ...c.log] }
}

function newBase(o: { name: string; seatCount: number; plan: "upfront" | "monthly"; owner: string; kickoffBooked: ISODate; today: ISODate }): Base {
  const id = o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.round(Math.random() * 1e4)
  const key = o.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "NEW"
  return {
    id, name: o.name, owner: o.owner, plan: o.plan,
    signedDate: o.today, kickoffBooked: o.kickoffBooked, kickoffDate: null,
    agreementSigned: true, paymentIn: true, baselineSigned: null, goalsCaptured: false, slackConnected: false,
    viktorAccess: null, readoutDay: 21, readoutAttended: false, day90Attended: false, usagePct: null,
    foundTarget: 40 + Math.round(Math.random() * 12), costPerSeatDay: 1.8,
    seats: seats(id, o.seatCount, () => ({ consent: false, ciSurvey: false })),
    agents: agents(key.toLowerCase(), [[14, 8], [22, 7], [28, 6], [40, 5], [46, 5], [52, 5], [58, 4], [64, 4], [70, 4], [76, 4], [82, 3], [86, 3], [88, 3]]),
    pauses: [], updatesSent: [], workflowsPublished: false, renewalOpened: false,
    linearKey: key, slackSlug: id.split("-")[0], log: [{ date: o.today, text: "Deal won in the CRM. Client created." }],
  }
}

export function seed(): State {
  const t = SEED_TODAY
  const base: Base[] = [
    {
      id: "mira", name: "Mira Creative", owner: "Subhan", plan: "upfront",
      signedDate: addDays(t, -2), kickoffBooked: addDays(t, 3), kickoffDate: null,
      agreementSigned: true, paymentIn: true, baselineSigned: null, goalsCaptured: false, slackConnected: false,
      viktorAccess: null, readoutDay: 21, readoutAttended: false, day90Attended: false, usagePct: null,
      foundTarget: 48, costPerSeatDay: 1.6,
      seats: seats("mira", 24, (i) => ({ consent: false, ciSurvey: false, installAt: null, ...(i < 0 ? {} : {}) })),
      agents: agents("mir", [[14, 8], [22, 7], [28, 6], [40, 5], [46, 5], [52, 5], [58, 4], [64, 4], [70, 4], [76, 4], [82, 3], [86, 3], [88, 3]]),
      pauses: [], updatesSent: [], workflowsPublished: false, renewalOpened: false,
      linearKey: "MIR", slackSlug: "mira", log: [{ date: addDays(t, -2), text: "Deal won in the CRM. Client created." }],
    },
    {
      id: "signal", name: "Signal & Co", owner: "AI specialist", plan: "monthly",
      signedDate: addDays(t, -6), kickoffBooked: addDays(t, -2), kickoffDate: addDays(t, -2),
      agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -2), goalsCaptured: true, slackConnected: true,
      viktorAccess: null, readoutDay: 21, readoutAttended: false, day90Attended: false, usagePct: null,
      foundTarget: 52, costPerSeatDay: 2.11,
      seats: seats("signal", 31, (i) => ({
        installAt: i < 9 ? addDays(t, -2 + (i % 2)) : i < 21 ? addDays(t, 1) : null,
        consent: i < 12,
      })),
      agents: agents("sig", [[14, 9], [21, 7], [27, 6], [38, 6], [44, 5], [50, 5], [56, 5], [62, 4], [68, 4], [74, 4], [80, 3], [85, 3], [88, 3]]),
      pauses: [], updatesSent: [], workflowsPublished: false, renewalOpened: false,
      linearKey: "SIG", slackSlug: "signal", log: [{ date: addDays(t, -2), text: "Kickoff held. 48-hour install clock started." }],
    },
    {
      id: "kova", name: "Kova Growth", owner: "AI specialist", plan: "upfront",
      signedDate: addDays(t, -10), kickoffBooked: addDays(t, -6), kickoffDate: addDays(t, -6),
      agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -6), goalsCaptured: true, slackConnected: true,
      viktorAccess: addDays(t, -3), readoutDay: 21, readoutAttended: false, day90Attended: false, usagePct: null,
      foundTarget: 44, costPerSeatDay: 1.94,
      seats: seats("kova", 22, (i) => ({
        installAt: i < 18 ? addDays(t, -5) : null,
        consent: i < 20,
        ciSurvey: i < 15,
        ...(i === 3 || i === 9 ? { silentFrom: addDays(t, -1), silentTo: null } : {}),
      })),
      agents: agents("kov", [[14, 8], [22, 7], [28, 6], [39, 5], [45, 5], [51, 5], [57, 4], [63, 4], [69, 4], [75, 4], [81, 4], [85, 3], [88, 3]]),
      pauses: [], updatesSent: [addDays(t, -3)], workflowsPublished: false, renewalOpened: false,
      linearKey: "KOV", slackSlug: "kova", log: [{ date: addDays(t, -4), text: "48-hour clock passed with 4 seats missing (Requirement 1)." }],
    },
    {
      id: "brightpath", name: "Brightpath Media", owner: "Subhan", plan: "monthly",
      signedDate: addDays(t, -26), kickoffBooked: addDays(t, -22), kickoffDate: addDays(t, -22),
      agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -22), goalsCaptured: true, slackConnected: true,
      viktorAccess: null, readoutDay: 21, readoutAttended: false, day90Attended: false, usagePct: null,
      foundTarget: 46, costPerSeatDay: 1.72,
      seats: seats("bright", 26, (i) => ({
        installAt: addDays(t, -21),
        ciSurvey: i < 19,
        ...(i === 0 || i === 1 ? { silentFrom: addDays(t, -1), silentTo: null } : {}),
      })),
      agents: agents("bri", [[14, 9], [33, 7], [36, 6], [40, 6], [45, 6], [51, 5], [57, 5], [62, 5], [68, 4], [73, 4], [79, 4], [84, 3], [88, 3]], [{ blocked: "qa_failing" }]),
      pauses: [{ start: addDays(t, -14), days: 3, reason: "Owner travelling, kickoff follow-ups delayed by the client" }],
      updatesSent: [addDays(t, -17), addDays(t, -10), addDays(t, -3)], workflowsPublished: false, renewalOpened: false,
      linearKey: "BRI", slackSlug: "brightpath", log: [{ date: addDays(t, -14), text: "Clock paused 3 days: owner travelling." }],
    },
    {
      id: "northline", name: "Northline Digital", owner: "Subhan", plan: "upfront",
      signedDate: addDays(t, -38), kickoffBooked: addDays(t, -34), kickoffDate: addDays(t, -34),
      agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -34), goalsCaptured: true, slackConnected: true,
      viktorAccess: addDays(t, -31), readoutDay: 21, readoutAttended: true, day90Attended: false, usagePct: 72,
      foundTarget: 52, costPerSeatDay: 2.43,
      seats: seats("north", 28, (i) => ({ installAt: addDays(t, -33), ...(i === 5 ? { silentFrom: addDays(t, 0), silentTo: null } : {}) })),
      agents: agents("nor", [[12, 7], [20, 6], [26, 5], [31, 5], [40, 6], [45, 5], [52, 5], [58, 5], [63, 5], [70, 5], [75, 5], [80, 4], [85, 4]]),
      pauses: [], updatesSent: [addDays(t, -31), addDays(t, -24), addDays(t, -17), addDays(t, -10), addDays(t, -3)], workflowsPublished: true, renewalOpened: false,
      linearKey: "NOR", slackSlug: "northline", log: [{ date: addDays(t, -4), text: "Day-30 guarantee met: 52 h/wk found, first agent live day 12." }],
    },
    {
      id: "halden", name: "Halden Agency", owner: "Subhan", plan: "monthly",
      signedDate: addDays(t, -90), kickoffBooked: addDays(t, -86), kickoffDate: addDays(t, -86),
      agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -86), goalsCaptured: true, slackConnected: true,
      viktorAccess: addDays(t, -83), readoutDay: 21, readoutAttended: true, day90Attended: false, usagePct: 64,
      foundTarget: 49, costPerSeatDay: 2.49,
      seats: seats("hald", 19, () => ({ installAt: addDays(t, -85) })),
      agents: agents("hal", [[13, 6], [20, 5], [27, 5], [35, 4], [42, 4], [48, 4], [55, 3], [61, 3], [67, 3], [72, 3], [78, 2], [88, 2], [89, 2]], [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { blocked: "qa_failing" }]),
      pauses: [], updatesSent: [addDays(t, -3)], workflowsPublished: true, renewalOpened: false,
      linearKey: "HAL", slackSlug: "halden", log: [{ date: addDays(t, -10), text: "Day-75 renewal window opened." }],
    },
    // Two clients on the recurring plan after day 90: one healthy, one at risk of churning.
    {
      id: "ferro", name: "Ferro Partners", owner: "Salman", plan: "upfront",
      signedDate: addDays(t, -155), kickoffBooked: addDays(t, -150), kickoffDate: addDays(t, -150),
      agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -150), goalsCaptured: true, slackConnected: true,
      viktorAccess: addDays(t, -147), readoutDay: 21, readoutAttended: true, day90Attended: true, usagePct: 81,
      foundTarget: 58, costPerSeatDay: 1.7,
      seats: seats("ferro", 24, () => ({ installAt: addDays(t, -149) })),
      agents: agents("fer", [[12, 7], [19, 6], [25, 6], [32, 5], [38, 5], [45, 5], [52, 4], [58, 4], [64, 4], [70, 4], [76, 3], [82, 3], [88, 3]]),
      pauses: [], updatesSent: [], workflowsPublished: true, renewalOpened: true,
      linearKey: "FER", slackSlug: "ferro", log: [{ date: addDays(t, -60), text: "Day-90 review held. Moved to the recurring plan." }],
    },
    {
      id: "corvid", name: "Corvid & Co", owner: "Salman", plan: "monthly",
      signedDate: addDays(t, -195), kickoffBooked: addDays(t, -190), kickoffDate: addDays(t, -190),
      agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -190), goalsCaptured: true, slackConnected: true,
      viktorAccess: addDays(t, -186), readoutDay: 21, readoutAttended: true, day90Attended: true, usagePct: 41,
      foundTarget: 47, costPerSeatDay: 2.3,
      seats: seats("corvid", 21, (i) => ({ installAt: addDays(t, -189), ...(i % 6 === 2 ? { silentFrom: addDays(t, -9), silentTo: null } : {}) })),
      agents: agents("cor", [[14, 6], [22, 6], [28, 5], [36, 5], [44, 4], [50, 4], [58, 4], [64, 3], [72, 3], [80, 3], [86, 2], [88, 2], [89, 2]], [{}, {}, { manual: "qa" }, {}, { blocked: "qa_failing" }, {}, { manual: "qa" }]),
      pauses: [], updatesSent: [], workflowsPublished: true, renewalOpened: true,
      linearKey: "COR", slackSlug: "corvid", log: [{ date: addDays(t, -100), text: "Day-90 review held. Moved to the recurring plan." }],
    },
  ]
  const opts: Record<string, Opts> = {
    mira: {},
    signal: { goals: "draft" },
    kova: { goals: "published" },
    brightpath: { goals: "published", sops: "draft", fit: "imported" },
    northline: { payroll: "csv", published: 14, goals: "published", sops: "published", fit: "published", scorecards: 1 },
    ferro: { payroll: "csv", published: 14, goals: "published", sops: "published", fit: "published", scorecards: 2 },
    corvid: { published: 14, goals: "published", sops: "published", fit: "published", scorecards: 2 },
    halden: { published: 14, goals: "published", sops: "published", fit: "published", scorecards: 2 },
  }
  const clients = base.map((b) => enrich(b, t, opts[b.id]))
  // A draft Weekly Progress Update waiting for this Friday on the busiest client.
  clients[3].reports.unshift(wpuReport(clients[3], fridayOf(t), "draft"))
  // Anyone more than three weeks in finished setup long ago, so Get started never holds them.
  for (const c of clients) if (c.kickoffDate && c.kickoffDate < addDays(t, -21)) c.prefs = Object.fromEntries(c.seats.map((x) => [x.id, { ...(c.prefs[x.id] ?? { pausedUntil: null, start: null, end: null, block: [], allow: [] }), checklist: ["complete"] }]))
  const ferro = clients.find((c) => c.id === "ferro")!
  Object.assign(ferro, { price: 3000, engagement: { reportOpens30: 6, reviewsMissed: 0 } })
  const corvid = clients.find((c) => c.id === "corvid")!
  corvid.sub = { history: [{ at: addDays(t, -40), by: "Salman", text: "10% discount for 2 months: goodwill after a late agent" }] }
  Object.assign(corvid, { price: 3000, engagement: { reportOpens30: 0, reviewsMissed: 2 }, deliveryLate: ["2 new agents built", "Monthly review call"] })
  podAgency(clients.find((c) => c.id === "northline")!)
  const ni = clients.findIndex((c) => c.id === "northline")
  clients[ni] = withGoalLevels(clients[ni], t, false)
  const p = pilot(t)
  if (p) clients.unshift(p)
  clients.unshift(withGoalLevels(demoClient(t), t, true))
  // Contracts are signed in the e-signature tool; Studio keeps the facts and a link. Consent is per person.
  for (const c of clients) {
    if (c.agreementSigned) c.contract = { version: `${APP} agreement v1.2`, signed: c.signedDate, signer: c.seats[0]?.name ?? "Owner", term: "90 days, then monthly", url: "#signed-agreement" }
    c.consentVersion = "Consent form v1.0"
    // Consent was given at install or kickoff, never in the future.
    c.seats = c.seats.map((x) => { const at = [x.consentAt, x.installAt, c.kickoffDate, c.signedDate].find((d) => d && d <= t) ?? c.signedDate; return x.consent ? { ...x, consentAt: at, consentVersion: "Consent form v1.0" } : x })
  }
  const requests: State["requests"] = [
    { id: "r1", clientId: "brightpath", from: "Owner (Brightpath)", source: "Client app", kind: "Question", title: "Why is the client report agent not live yet?", detail: "We were told week two. What is blocking it?", created: addDays(t, -1), status: "New", priority: "High", assignee: "Subhan", linear: null, thread: [] },
    { id: "r2", clientId: "northline", from: "Member (Northline)", source: "Member", kind: "Data deletion", title: "Delete what was captured on Oct 22", detail: "Personal appointment during work hours.", scope: "day", created: addDays(t, -2), status: "In progress", priority: "Normal", assignee: "Subhan", linear: null, thread: [] },
    { id: "r3", clientId: "halden", from: "AI specialist", source: "Team", kind: "Bug", title: "Proposal formatting agent fails on long docs", detail: "QA run times out on proposals over 20 pages.", created: addDays(t, -3), status: "Sent to Linear", priority: "High", assignee: "Hashim", linear: { id: "SHA-142", state: "In progress" }, thread: [] },
    ...PILOT_REQUESTS(t),
    { id: "r6", clientId: "larkspur", from: "Priya Shah (Larkspur)", source: "Client app", kind: "Question", title: "Can the report agent use our new slide template?", detail: "We changed the deck template this month.", created: addDays(t, -6), status: "Done", priority: "Normal", assignee: "Subhan", linear: null, thread: [{ at: addDays(t, -5), who: "Subhan", text: "Done. The agent uses the new template from this month's reports on." }] },
    { id: "r5", clientId: "kova", from: "Alert", source: "Alert", kind: "Bug", title: "Two computers silent for over a day", detail: "Nudges sent, no data since yesterday.", created: t, status: "New", priority: "Urgent", assignee: "AI specialist", linear: null, thread: [] },
  ]
  // Who else works each client. A Specialist or Viewer sees only clients they own or are on.
  const STAFF: Record<string, string[]> = { larkspur: ["Salman", "Board advisor"], northline: ["AI specialist"], ferro: ["Board advisor"] }
  for (const c of clients) c.staff = STAFF[c.id] ?? []
  // Renewals: Ferro and Corvid renewed before their day 90; Halden is at day 86 with the renewal open.
  for (const c of clients) {
    if (c.id === "ferro" || c.id === "corvid") c.renewal = sampleRenewed(c, c.price ?? 3000)
    if (c.id === "halden") { c.renewal = { stage: "Open", openedAt: dateOfDay(c, 75)! }; c.renewalOpened = true }
  }
  // Interview credits only count people who actually do that kind of work.
  for (const c of clients) {
    const doers = (cat: string) => new Set(c.seats.filter((x) => (ROLE_CATS[x.role] ?? []).includes(cat)).map((x) => x.name))
    c.workflows = c.workflows.map((w) => { const d = doers(w.category); return { ...w, verifiedBy: w.verifiedBy?.filter((n) => d.has(n)), handoffBy: w.handoffBy?.filter((n) => d.has(n)) } })
  }
  return { version: 22, bugs: sampleBugs(t), pricing: { recurring: [{ from: "2026-01-01", monthly: 3000 }], upfront: 5000, monthly: 6000 }, stripe: { via: "key", at: addDays(t, -14) }, requests, linearSeq: 150, sequence: SEQUENCE, autopilot: Object.fromEntries(clients.map((c) => [c.id, c.id !== "halden"])), sends: [
    { id: "sd1", clientId: "larkspur", seatIds: ["larkspur-s17"], stepId: "rec-nudge", at: addDays(t, -3), status: "Sent", by: "Subhan", body: `Hi Nadia, ${APP} went quiet on your Mac. Paused or closed? Reopen it from the menu bar when you're back on work.` },
    { id: "sd2", clientId: "larkspur", seatIds: ["larkspur-s31"], stepId: "per-fix", at: addDays(t, -5), status: "Sent", by: "Subhan", body: `Almost there. Open System Settings > Privacy & Security, switch on ${APP} under Screen Recording, Accessibility and Input Monitoring, then reopen it.` },
    { id: "sd3", clientId: "larkspur", seatIds: ["larkspur-s31"], stepId: "owner:Permissions missing", at: addDays(t, -1), status: "Sent", by: "Dana Whitfield", body: `Hi Nora, ${APP} needs its 3 Mac permissions: Screen Recording, Accessibility and Input Monitoring. System Settings > Privacy & Security.` },
  ], slack: {}, sender: "Subhan", today: t, me: "Subhan", team: TEAM, clients, sim: { pipelineFailing: true }, settings: DEFAULT_SETTINGS, acks: {}, done: {}, assign: {}, viewLog: [], audit: [] }
}

/** Northline runs on pods: each pod owns its clients and has a lead. Pod D has two people, so it
 *  rolls up in team views (nobody under 3 is shown alone). */
function podAgency(c: Client) {
  const PODS = [["Pod A", ["Harbor Bank", "Cinder Coffee", "Vale Health"]], ["Pod B", ["Tidewater", "Copper Lane", "Avalon Labs"]], ["Pod C", ["Northpeak", "Juniper Home"]], ["Pod D", ["Marlow Legal"]]] as const
  const podOf = (i: number) => (i >= c.seats.length - 2 ? 3 : i % 3)
  c.org = "pod"
  c.seats = c.seats.map((x, i) => ({ ...x, pod: PODS[podOf(i)][0] }))
  c.pods = PODS.map(([name, clients], k) => ({ name, lead: c.seats[c.seats.findIndex((_, i) => podOf(i) === k)].id, clients: [...clients] }))
  c.teamsConfirmed = c.kickoffDate
  c.workflows = c.workflows.map((w, i) => ({ ...w, clients: PODS.flatMap(([, cl]) => cl).filter((_, j) => (i + j) % 3 === 0) }))
  // The Business profile lists the same pods, so Results can show revenue and clients per person.
  c.business = {
    offer: "Paid media and SEO retainers for local businesses", pricing: "Monthly retainer, $2,500 to $6,000",
    pods: PODS.map(([name, clients], k) => ({ name, people: c.seats.filter((_, i) => podOf(i) === k).length, clients: clients.length, revenueMo: clients.length * 4200 })),
    execRate: 95, ownerValue: 250, targetMargin: 30, otherCompanies: [],
  }
}


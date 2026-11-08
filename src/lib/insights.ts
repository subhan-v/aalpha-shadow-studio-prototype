// The insight catalogue (build spec Part 4, locked 2026-10-30). Every insight is one entry,
// defined once. The client Home, the Slack digest and Studio's Catalogue all read from here;
// no page computes a number of its own. Sample data, so the evidence rows are made up too.

import { handoffs, responseTime, slackAsks, teamStats, valueMo, WK_TO_MO } from "./client-data"
import { addDays, fmt, hash } from "./dates"
import { agentStatus, dayN, hoursBack, hoursFound, installed, visibleWorkflows } from "./engine"
import { afterHoursPct, execWeek, focusOf, handOffWk, personStats, shareOf } from "./people"
import { recordingNow } from "./recording"
import { results } from "./results"
import type { Client, FeedbackAction, InsightFeedback, ISODate, Seat, State } from "./types"

export type Audience = "CEO" | "Manager" | "Staff"
export type Depth = 1 | 2 | 3 | 4
export type Stage = "Draft" | "Back-test" | "Beta" | "Live" | "Retired"
export const DEPTH_LABEL: Record<Depth, string> = { 1: "Slack", 2: "Slack + desktop", 3: "Slack + desktop + connectors", 4: "Everything + org chart" }
/** The source each depth adds. An entry needs its own source; a client may have desktop before Slack. */
export const SOURCE: Record<Depth, string> = { 1: "Slack", 2: "desktop", 3: "connectors", 4: "org chart" }
export const FEEDBACK: FeedbackAction[] = ["Useful", "Not right", "Already handled", "Act on it"]

// scoped: a manager's teams only; full: the whole client, so shares split across everyone as on People
export type Ctx = { c: Client; today: ISODate; me: Seat; money: boolean; scoped?: boolean; full?: Client }
type Cell = string | number
export type Result = {
  value: string
  unit?: string
  line: string
  tone?: "good" | "warn" | "bad"
  rank: number // higher shows first
  people?: Seat[] // whose data the number rests on, for "based on n of m"
  evidence: { title: string; columns: { key: string; label: string; right?: boolean }[]; rows: Record<string, Cell>[] }
  action?: { label: string; go?: string; request?: string }
}
export type Entry = {
  id: string
  question: string
  audience: Audience[]
  depth: Depth // minimum sources it needs
  stage: Stage
  version: string
  how: string // plain-words definition, shown under "How we count this"
  money?: boolean // shows dollars, so owners only
  run: (x: Ctx) => Result | null
}

const r1 = (n: number) => Math.round(n * 10) / 10
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`
const desktop = (c: Client, today: ISODate) => c.seats.filter((s) => installed(s, today))

export const CATALOGUE: Entry[] = [
  {
    id: "hours-found", question: "How much repeat work could come off the team's plate?", audience: ["CEO", "Manager"], depth: 2, stage: "Live", version: "v3",
    how: "Runs a week times minutes a run, for every opportunity workflow not marked never-automate. The same total as Overview's opportunity hours.",
    run: ({ c, today }) => {
      const st = teamStats(c, today)
      if (!hoursFound(c, today) || !st.total) return null
      const vis = visibleWorkflows(c, today).filter((w) => !w.neverAutomate)
      return {
        value: String(r1(st.total / WK_TO_MO)), unit: "h/wk", line: `About ${Math.round(st.total)} hours a month across ${st.workflows} workflows`, rank: 90, tone: "good", people: desktop(c, today),
        evidence: { title: "Workflows behind this number", columns: [{ key: "w", label: "Workflow" }, { key: "cat", label: "Category" }, { key: "h", label: "Hours a week", right: true }], rows: vis.map((w) => ({ w: w.name, cat: w.category, h: r1(w.hoursWk) })) },
        action: { label: "See the workflows", go: "workflows" },
      }
    },
  },
  {
    id: "hours-back", question: "How many hours are agents giving back?", audience: ["CEO", "Manager"], depth: 2, stage: "Live", version: "v2",
    how: "Successful runs a week of every live agent times minutes saved a run, against the baseline locked at kickoff.",
    run: ({ c, today, scoped, full }) => {
      const live = c.agents.filter((a) => agentStatus(a, c, today) === "live")
      if (!live.length) return null
      // A manager's share lands on the people in their teams, as on the People page.
      const back = r1(scoped ? c.seats.reduce((n, s) => n + personStats(full ?? c, s, today).backWk, 0) : hoursBack(c, today))
      return {
        value: String(back), unit: "h/wk", line: `${live.length} of ${c.agents.length} agents live`, rank: 80, tone: "good", people: desktop(c, today),
        evidence: { title: "Live agents", columns: [{ key: "a", label: "Agent" }, { key: "cat", label: "Category" }, { key: "h", label: "Hours back a week", right: true }], rows: live.map((a) => ({ a: a.name, cat: a.category ?? "", h: r1(a.baselineHrsWk * a.savesPct) })) },
        action: { label: "See results", go: "automations" },
      }
    },
  },
  {
    id: "value-back", question: "What is the time back worth?", audience: ["CEO"], depth: 2, stage: "Live", version: "v2", money: true,
    how: "Hours back times the loaded hourly cost of the people whose role does that work; an estimate until payroll is connected.",
    run: ({ c, today, scoped }) => {
      const r = results(c, today)
      if (!r.agents.length || scoped) return null
      return {
        value: usd(r.money.valueMo), unit: "a month", line: c.connections.payroll === "none" ? "At an estimated rate until payroll is connected" : "At each person's payroll rate", rank: 78, people: desktop(c, today),
        evidence: { title: "Value by agent", columns: [{ key: "a", label: "Agent" }, { key: "v", label: "Value a month", right: true }], rows: r.agents.map((x) => ({ a: x.a.name, v: usd(x.valueMo) })) },
      }
    },
  },
  {
    id: "top-opportunity", question: "What should we automate next?", audience: ["CEO", "Manager"], depth: 2, stage: "Live", version: "v1",
    how: "The opportunity workflow with the highest value a month.",
    run: ({ c, today, money }) => {
      const w = visibleWorkflows(c, today).filter((x) => !x.neverAutomate).sort((a, b) => valueMo(c, b.hoursWk, b.category) - valueMo(c, a.hoursWk, a.category))[0]
      if (!w) return null
      return {
        value: money ? usd(valueMo(c, w.hoursWk, w.category)) : String(Math.round(w.hoursWk * WK_TO_MO)), unit: money ? "a month" : "h a month", line: w.name, rank: 85,
        evidence: { title: w.name, columns: [{ key: "k", label: "" }, { key: "v", label: "", right: true }], rows: [{ k: "Hours a week", v: r1(w.hoursWk) }, { k: "Category", v: w.category }, { k: "People who do it", v: w.people }] },
        action: { label: "Automate this", request: `Automate: ${w.name}` },
      }
    },
  },
  {
    id: "repeat-asks", question: "Which question does the team answer by hand most?", audience: ["Manager", "CEO"], depth: 1, stage: "Beta", version: "v1",
    how: "Slack asks grouped by topic over the last 30 days; the topic asked most often.",
    run: ({ c, today }) => {
      const a = slackAsks(c, today)
      if (!a) return null
      const top = [...a.rows].sort((x, y) => y.total - x.total)[0]
      return {
        value: String(top.total), unit: "asks", line: `"${top.topic}" in the last 30 days, ${top.open} still open`, rank: 70, tone: "warn",
        evidence: { title: "Slack asks by topic, last 30 days", columns: [{ key: "t", label: "Topic" }, { key: "n", label: "Asks", right: true }, { key: "o", label: "Open", right: true }, { key: "h", label: "Hours to done", right: true }], rows: a.rows.map((x) => ({ t: x.topic, n: x.total, o: x.open, h: x.hoursToDone })) },
        action: { label: "Automate the answers", request: `Automate answers to "${top.topic}" in Slack` },
      }
    },
  },
  {
    id: "where-work-waits", question: "Where does work wait longest between teams?", audience: ["Manager", "CEO"], depth: 1, stage: "Live", version: "v2",
    how: "Hand-offs seen in Slack between teams over 30 days; average wait from hand-off to the next reply.",
    run: ({ c }) => {
      if (!c.slackConnected) return null
      const h = handoffs(c)
      return {
        value: String(h[0].waitHrs), unit: "h wait", line: `${h[0].from} to ${h[0].to}, ${h[0].count} hand-offs`, rank: 72, tone: h[0].waitHrs > 12 ? "bad" : "warn",
        evidence: { title: "Hand-offs between teams", columns: [{ key: "f", label: "From" }, { key: "t", label: "To" }, { key: "n", label: "Hand-offs", right: true }, { key: "w", label: "Average wait (h)", right: true }], rows: h.map((x) => ({ f: x.from, t: x.to, n: x.count, w: x.waitHrs })) },
        action: { label: "Fix this hand-off", request: "Help with the hand-off between teams" },
      }
    },
  },
  {
    id: "reply-time", question: "How fast does the team answer each other?", audience: ["Manager"], depth: 1, stage: "Live", version: "v1",
    how: "Median time from an @mention to the first reply, team level only.",
    run: ({ c }) => {
      if (!c.slackConnected) return null
      const rt = responseTime(c)
      return {
        value: String(rt.medianMin), unit: "min", line: `${rt.within1h}% answered within an hour`, rank: 40,
        evidence: { title: "Reply times to @mentions", columns: [{ key: "b", label: "Reply time" }, { key: "s", label: "Share", right: true }], rows: rt.buckets.map(([b, s]) => ({ b, s: `${Math.round(s * 100)}%` })) },
      }
    },
  },
  {
    id: "waiting-on-you", question: "What is waiting on you right now?", audience: ["CEO"], depth: 1, stage: "Beta", version: "v1",
    how: "Approvals and asks addressed to you in Slack with no reply yet.",
    run: ({ c, me }) => {
      if (!c.slackConnected) return null
      const w = execWeek(c, me)
      return {
        value: String(w.approvalsWaiting), unit: "waiting", line: "Approvals and replies addressed to you", rank: w.approvalsWaiting > 8 ? 95 : 60, tone: w.approvalsWaiting > 8 ? "warn" : undefined, people: [me],
        evidence: { title: "Waiting on you", columns: [{ key: "k", label: "Kind" }, { key: "n", label: "Count", right: true }], rows: [{ k: "Approvals", n: Math.ceil(w.approvalsWaiting * 0.6) }, { k: "Questions", n: Math.floor(w.approvalsWaiting * 0.4) }] },
        action: { label: "Set an approval rule", request: "Set up an approval rule for routine sign-offs" },
      }
    },
  },
  {
    id: "recording", question: "Is the whole team being measured?", audience: ["CEO", "Manager"], depth: 2, stage: "Live", version: "v2",
    how: "People recording or paused, against everyone not on leave or excluded.",
    run: ({ c, today }) => {
      const rec = recordingNow(c, c.seats, today)
      const att = rec.attention
      return {
        value: `${rec.on}/${rec.of}`, unit: "recording", line: att.length ? `${att.length} need attention` : "Everyone is recording", rank: att.length ? 65 : 20, tone: att.length ? "warn" : "good",
        evidence: { title: "Recording status", columns: [{ key: "p", label: "Person" }, { key: "r", label: "Role" }, { key: "s", label: "Status" }], rows: rec.rows.map((x) => ({ p: x.s.name, r: x.s.role, s: x.status })) },
        action: att.length ? { label: "Nudge them", go: "roster" } : undefined,
      }
    },
  },
  {
    id: "key-person", question: "Who could the business not run without this week?", audience: ["CEO"], depth: 4, stage: "Beta", version: "v1",
    how: "From the confirmed org chart: the person most cross-team work routes through.",
    run: ({ c }) => {
      const k = c.fit.find((f) => f.keyPerson)
      const s = k && c.seats.find((x) => x.id === k.seatId)
      if (!s) return null
      return {
        value: s.name.split(" ")[0], line: `${s.role}: a lot of work runs through them`, rank: 55, tone: "warn",
        evidence: { title: "Key person", columns: [{ key: "k", label: "" }, { key: "v", label: "", right: true }], rows: [{ k: "Role", v: s.role }, { k: "Team", v: k!.team }, { k: "Hours a week observed", v: k!.loadHrs }] },
        action: { label: "Plan a backup", request: `Plan a backup for ${s.name}` },
      }
    },
  },
  {
    id: "my-hand-off", question: "How much of my week could someone else do?", audience: ["Staff"], depth: 2, stage: "Live", version: "v2",
    how: "Your share of the opportunity workflows in your role (locked definition L1).",
    run: ({ c, today, me }) => {
      const wk = handOffWk(c, me, today)
      const ws = personStats(c, me, today).workflows.filter((w) => !w.neverAutomate)
      return {
        value: String(wk), unit: "h/wk", line: ws[0] ? `Biggest: ${ws[0].name}` : "Nothing repeatable found in your role yet", rank: 80, people: [me],
        evidence: { title: "Your repeat work", columns: [{ key: "w", label: "Workflow" }, { key: "h", label: "Your hours a week", right: true }], rows: ws.map((w) => ({ w: w.name, h: r1(shareOf(c, w)) })) },
        action: { label: "See my time", go: "me" },
      }
    },
  },
  {
    id: "my-focus", question: "How much deep focus did I get?", audience: ["Staff"], depth: 2, stage: "Live", version: "v2",
    how: "Hours in blocks of 25 minutes or more, with the longest block (locked definition L1).",
    run: ({ c, me }) => {
      const f = focusOf(c, me)
      return { value: String(f.hours), unit: "h", line: `Longest block ${f.longestMin} min`, rank: 60, tone: f.hours < 3 ? "warn" : undefined, people: [me], evidence: { title: "Focus", columns: [{ key: "k", label: "" }, { key: "v", label: "", right: true }], rows: [{ k: "Deep focus hours", v: f.hours }, { k: "Longest block (min)", v: f.longestMin }] } }
    },
  },
  {
    id: "my-after-hours", question: "How much do I work outside my hours?", audience: ["Staff"], depth: 2, stage: "Live", version: "v2",
    how: "Share of active time, desktop and Slack together, outside your scheduled hours (locked definition L1).",
    run: ({ c, me }) => {
      const p = afterHoursPct(c, me)
      return { value: `${p}%`, line: "Of your active time", rank: p > 30 ? 75 : 30, tone: p > 30 ? "warn" : undefined, people: [me], evidence: { title: "After hours", columns: [{ key: "k", label: "" }, { key: "v", label: "", right: true }], rows: [{ k: "Share outside set hours", v: `${p}%` }] } }
    },
  },
]

/** Drafts and retired entries live in the Insight Lab, not on client pages. */
export const LAB: { id: string; question: string; stage: Stage; source: string; note: string }[] = [
  { id: "status-rituals", question: "Which updates does the team post by hand on a schedule?", stage: "Back-test", source: "Pattern seen at 3 clients", note: "90-day back-test running; analyst sample due Friday" },
  { id: "chase-loops", question: "Which asks get chased two or more times?", stage: "Draft", source: "Suggested: repeat custom report", note: "Needs the request open/close label (Phase B)" },
  { id: "rubber-stamp", question: "Which approvals are almost always yes?", stage: "Draft", source: "Suggested: unanswered question", note: "Waiting on D2 (named people)" },
  { id: "founder-pull", question: "How much of the team's work stops at the founder?", stage: "Back-test", source: "Outcome signal: predicts renewal", note: "Back-test matched hand count on 2 of 3 clients" },
  { id: "meeting-cost", question: "What do meetings cost each week?", stage: "Draft", source: "Needs calendar (depth 3)", note: "Only 1 client has calendar connected" },
  { id: "msg-share", question: "What share of the day goes to messages?", stage: "Retired", source: "Low Useful rate", note: "Replaced by My time's type of work" },
]

export const audienceOf = (role: "Owner" | "Manager" | "Member", exec: boolean): Audience => (role === "Owner" || exec ? "CEO" : role === "Manager" ? "Manager" : "Staff")

/** Which sources this client has: Slack, desktop, connectors, a confirmed org chart. */
export function sourcesOf(c: Client, today: ISODate): Record<Depth, boolean> {
  const conn = c.connections.calendar || c.connections.hubspot || c.connections.callNotes || c.connections.payroll !== "none"
  return { 1: c.slackConnected, 2: c.seats.some((s) => installed(s, today)), 3: conn, 4: !!c.teamsConfirmed && c.fit.some((f) => f.reportsTo) }
}

/** "Slack, desktop and connectors": what the feed is built on, in plain words. */
export function builtOn(c: Client, today: ISODate) {
  const have = ([1, 2, 3, 4] as Depth[]).filter((d) => sourcesOf(c, today)[d]).map((d) => SOURCE[d])
  return have.length < 2 ? have.join("") || "nothing yet" : `${have.slice(0, -1).join(", ")} and ${have[have.length - 1]}`
}

/** What connecting the next missing source would add, shown once under the feed. */
export function nextDepth(c: Client, today: ISODate) {
  const src = sourcesOf(c, today)
  if (!src[1]) return "Connect Slack to see where work waits between people and which questions repeat."
  if (!src[2]) return "Install the desktop app to see hours, tools and focus behind every Slack finding."
  if (!src[3]) return "Connect your calendar or CRM to see meeting cost and time per client."
  if (!src[4]) return "Confirm your org chart to see where work really flows versus the chart."
  return null
}

/** Desktop numbers can't be current while vision analysis is behind; show the last good value instead. */
export const stale = (s: State, e: Entry) => s.sim.pipelineFailing && e.depth >= 2

export function lastGood(today: ISODate) {
  return fmt(addDays(today, -1))
}

export function feed(x: Ctx, aud: Audience) {
  const src = sourcesOf(x.c, x.today)
  return CATALOGUE.filter((e) => (e.stage === "Live" || e.stage === "Beta") && e.audience.includes(aud) && src[e.depth] && (!e.money || x.money))
    .map((e) => ({ e, r: e.run(x) }))
    .filter((v): v is { e: Entry; r: Result } => !!v.r)
    .sort((a, b) => b.r.rank - a.r.rank)
}

/** Coverage line: whose data the number rests on. */
export function coverage(x: Ctx, r: Result) {
  // Same rule as the recording count everywhere: recording or paused, not on leave or excluded.
  if (!r.people || r.people.length === 1) return null
  const rec = recordingNow(x.c, x.c.seats, x.today)
  const ids = new Set(r.people.map((s) => s.id))
  return `based on ${rec.rows.filter((w) => ids.has(w.s.id) && (w.status === "Recording" || w.status === "Paused")).length} of ${rec.of} people`
}

/** Feedback counts per insight across clients. Sample baseline plus whatever people clicked here. */
export function feedbackStats(s: State, id: string) {
  const mine = (s.feedback ?? []).filter((f) => f.insightId === id)
  const base = (k: string, n: number) => Math.round(hash(id + k) * n)
  const count = (a: FeedbackAction) => mine.filter((f) => f.action === a).length
  const useful = base("u", 40) + 6 + count("Useful")
  const wrong = base("w", 9) + count("Not right")
  const handled = base("h", 10) + count("Already handled")
  const act = base("a", 14) + count("Act on it")
  const total = useful + wrong + handled + act
  return { useful, wrong, handled, act, total, usefulRate: Math.round(((useful + handled) / total) * 100), wrongRate: Math.round((wrong / total) * 100) }
}

export const myFeedback = (s: State, clientId: string, insightId: string, by: string): InsightFeedback | undefined =>
  [...(s.feedback ?? [])].reverse().find((f) => f.clientId === clientId && f.insightId === insightId && f.by === by)

/** Clients this entry is live on: their sources reach its depth. */
export const liveOn = (s: State, e: Entry) => s.clients.filter((c) => sourcesOf(c, s.today)[e.depth] && dayN(c, s.today) !== null).length

export const teamHoursObserved = (c: Client, today: ISODate) => teamStats(c, today).observed

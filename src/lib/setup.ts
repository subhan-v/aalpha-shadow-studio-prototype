// Setup: what every person and every account needs before Shadow is useful. Sign in with
// Slack (profiles sync from it), connectors through Composio, the Culture Intelligence survey
// link, the 5-minute interview, and the required onboarding steps for each role.

import { hash } from "./dates"
import { installed } from "./engine"
import { hasConsent } from "./consent"
import type { Client, Connector, InterviewSet, Role, Seat, State } from "./types"
import { APP } from "@/lib/flags"

// ── connectors ──────────────────────────────────────────────────────────────

export const CATALOG: { group: string; items: { name: string; feeds: string[]; ownerOnly?: boolean; note?: string }[] }[] = [
  { group: "Call recording", items: [{ name: "Fathom", feeds: ["Workflows", "Reports"] }, { name: "Zoom", feeds: ["Workflows", "Executive report"] }, { name: "Gong", feeds: ["Workflows", "Overview"] }] },
  { group: "CRM", items: [{ name: "HubSpot", feeds: ["Overview", "Results", "Executive report"] }, { name: "Aalpha CRM", feeds: ["Overview", "Results"] }, { name: "Salesforce", feeds: ["Overview", "Results"] }] },
  { group: "Email", items: [{ name: "Gmail", feeds: ["Workflows", "My time"] }, { name: "Outlook", feeds: ["Workflows", "My time"] }] },
  { group: "Calendar", items: [{ name: "Google Calendar", feeds: ["My time", "Executive report"] }, { name: "Outlook Calendar", feeds: ["My time", "Executive report"] }] },
  { group: "Banking", items: [{ name: "Bank feed (read-only)", feeds: ["Executive report"], ownerOnly: true, note: "Read-only. Only the owner connects it, it is scoped to Ops and finance, and members never see it." }] },
]

export function connectorsOf(c: Client): Connector[] {
  if (c.connectors) return c.connectors
  // Without a saved list, start from what the client already connected.
  const on: Record<string, boolean> = { HubSpot: c.connections.hubspot, "Google Calendar": c.connections.calendar, Fathom: c.connections.callNotes }
  return CATALOG.flatMap((g) => g.items.map((i) => ({ id: `${c.id}-${i.name}`, group: g.group, name: i.name, on: !!on[i.name], by: on[i.name] ? c.seats[0]?.name : null, at: on[i.name] ? c.kickoffDate : null, scope: i.ownerOnly ? ["Ops and finance"] : "company" as const })))
}

// ── Slack ───────────────────────────────────────────────────────────────────

const slug = (c: Client) => c.name.toLowerCase().replace(/\(.*\)/, "").replace(/[^a-z]+/g, "").slice(0, 12) || "agency"

/** What Slack sign-in gives us for a person: display name, handle, email, photo (an initials avatar here). */
export function slackOf(c: Client, s: Seat) {
  if (s.slack) return s.slack
  const parts = s.name.replace(/\./g, "").split(" ")
  const handle = parts.length > 1 && parts[1].length > 1 ? `${parts[0]}.${parts[1]}`.toLowerCase() : parts[0].toLowerCase()
  return { handle, display: parts[0] + (parts[1] && parts[1].length > 1 ? ` ${parts[1][0]}.` : ""), email: `${handle}@${slug(c)}.com`, hue: Math.round(hash(s.id) * 360), admin: s.id === c.seats[0]?.id }
}

export const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase()

/** Slack user groups suggest the teams at kickoff. */
export const userGroup = (team: string) => `@${team.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "")}`

/** A big agency's channel list: every client gets a few channels, plus the internal ones. */
export function bigChannelList(clients: string[]) {
  const internal = ["general", "announcements", "random", "social", "ask-ops", "client-reports", "paid-media", "creative", "seo", "sales", "finance", "leadership", "hiring", "wins", "standup", "design-crit", "tools", "it-help", "pto", "birthdays"]
  const per = ["", "-ads", "-reporting", "-creative", "-internal", "-seo", "-launch", "-billing", "-ext"]
  const names = [...internal, ...clients.flatMap((cl) => per.map((p) => `client-${cl.toLowerCase().replace(/[^a-z]+/g, "-")}${p}`))]
  return names.map((n, i) => ({ name: n, on: !["random", "social", "birthdays", "pto"].includes(n), private: n.endsWith("-internal") || n === "leadership" || n === "finance", members: 4 + Math.round(hash(n + i) * 26) }))
}

/** `client-*` style patterns: a trailing * matches any ending. */
export const matches = (name: string, pattern: string) => {
  const p = pattern.replace(/^#/, "").trim()
  return p.endsWith("*") ? name.startsWith(p.slice(0, -1)) : name === p
}

// ── Culture Intelligence survey link ────────────────────────────────────────

/** Created in Aalpha's Culture Intelligence account when an agency or team is created, unique to them. */
export const surveyLink = (c: Client) => c.ci.surveyLink ?? `https://survey.cultureintelligence.ai/a/${slug(c)}-${Math.round(hash(c.id) * 1e6).toString(36)}`

// ── interviews ──────────────────────────────────────────────────────────────

export const INTERVIEW_SETS: Record<InterviewSet, string[]> = {
  Executive: ["What does a great quarter look like in one or two numbers?", "Where does your own week go that you wish it didn't?", "Which decisions wait on you that shouldn't?", "What can't you see today that you'd want to?", "If the team got 40 hours a week back, where would you put them?"],
  Operations: ["Walk me through what happens when a new client signs.", "Where do handoffs between teams wait or break?", "What do you chase people for every week?", "Which reports or updates do you build by hand?", "Which process would you hand to an agent first?"],
  Delivery: ["What three things do you do every week no matter what?", "Which of them feels like copy-paste?", "Where do you wait on someone else?", "Which tools do you jump between most?", "What would you never want an agent to touch?"],
  Sales: ["Walk me through a lead from first touch to signed.", "Where do leads go cold?", "What do you update in the CRM by hand?", "How long does a proposal take?", "What would you hand off first: follow-ups, notes or proposals?"],
}
export const SET_LABEL: Record<InterviewSet, string> = { Executive: "CEO and executives", Operations: "Operations managers", Delivery: "Staff, analysts and delivery", Sales: "Sales" }

export function interviewSetFor(s: Seat): InterviewSet {
  if (isExecTitle(s.role) || s.exec) return "Executive"
  if (/sales/i.test(s.role)) return "Sales"
  if (/^ops$|operations|director/i.test(s.role)) return "Operations"
  return "Delivery"
}
export const questionsFor = (st: State, set: InterviewSet) => st.interviewSets?.[set] ?? INTERVIEW_SETS[set]

/** Executive seats come from titles; the owner can change who counts. */
export const isExecTitle = (role: string) => /^(ceo|coo|cfo|cto|founder|co-founder|president)$/i.test(role.trim())
export const isExec = (s: Seat) => s.exec ?? isExecTitle(s.role)

// ── consent ─────────────────────────────────────────────────────────────────

/** Consent counts only for the current version of the form; a new version asks everyone again. */
export { hasConsent, needsReconsent } from "./consent"

/** The summary shown before someone agrees. Only the approved privacy facts. */
/** What Shadow reads in Slack, in one sentence. Owner decision 2026-10-27; every screen uses this. */
export const SLACK_SCOPE = `In Slack, ${APP} reads public channels and the private channels your workspace admin is in. It never reads direct messages.`

export const CONSENT_POINTS = [
  `You choose the work apps and sites ${APP} sees, on an allowlist.`,
  "It takes screenshots at intervals, plus the app, site and clicks. It never records video and never uses your mic or camera.",
  "Private info is encrypted and redacted on your laptop before anything is sent.",
  "You set your own hours, and it switches off outside them. You can pause any time.",
  "The Chrome extension marks your work profile, so other profiles are avoided.",
  "Analytics look only at high-level patterns.",
  SLACK_SCOPE,
  "You can withdraw your consent in your settings. Recording stops for you when you do.",
]

// ── required onboarding ─────────────────────────────────────────────────────

export type Step = { k: string; name: string; body: string; done: boolean; auto?: boolean; tab?: string }

export function onboardingSteps(c: Client, s: Seat, role: Role, today: string): Step[] {
  const tick = c.prefs[s.id]?.checklist ?? []
  const inst = installed(s, today)
  // "complete" marks someone who finished setup before the checklist existed: their setup steps
  // count as done. Consent and the interview are real records and never assumed.
  const t = (k: string) => tick.includes(k) || tick.includes("complete")
  const legacy = tick.includes("complete")
  const all: Step[] = [
    { k: "slack", name: "Sign in with Slack", body: "Your name, photo and email come from your Slack profile.", done: !!s.slack || inst || legacy, auto: true },
    { k: "consent", name: "Agree to the consent form", body: `What ${APP} records and what it never does, in plain words. Required before you install.`, done: hasConsent(c, s) },
    { k: "install", name: `Install ${APP} on your work laptop`, body: "The link is in Slack. About 3 minutes.", done: inst || legacy, auto: true },
    { k: "perms", name: "Turn on the 3 Mac permissions", body: "Screen Recording, Accessibility and Input Monitoring.", done: (inst || legacy) && s.permissions !== false, auto: true },
    { k: "interview", name: "Do your 5-minute interview", body: "Five questions about your work, by voice. You approve the summary.", done: !!s.interview, tab: "interview" },
  ]
  const owner: Step[] = [
    { k: "teams", name: "Confirm your teams", body: "Suggested from Slack user groups, job titles and the Fit Map.", done: !!c.teamsConfirmed || legacy, auto: true, tab: "roster" },
    { k: "slackscope", name: `Confirm what ${APP} reads in Slack`, body: "Public channels and the private channels you're in, never direct messages. Your team sees the same line in their consent form.", done: !!c.connections.slackDisclosure || legacy },
    { k: "connectors", name: "Connect your tools", body: "Call recording, CRM, email, calendar.", done: connectorsOf(c).filter((x) => x.on).length >= 2 || legacy, auto: true, tab: "settings" },
    { k: "schedule", name: "Set the recording schedule", body: "Work hours, 24/7 or custom, for the team or per person.", done: t("schedule") || !!c.capture.preset, tab: "settings" },
    { k: "invite", name: "Invite your team", body: "Every invite goes out through Slack and needs a team.", done: c.seats.length > 1, auto: true, tab: "settings" },
    { k: "goals", name: "Lock in your goals", body: "They steer every ranking.", done: !!c.goalLock?.locked || legacy, auto: true, tab: "goals" },
  ]
  const manager: Step[] = [
    { k: "teamlist", name: "Confirm your team list", body: "Check everyone on your team is in the right place.", done: t("teamlist"), tab: "roster" },
    { k: "teamsched", name: "Review your team's schedule", body: `Hours ${APP} records for each person.`, done: t("teamsched"), tab: "settings" },
  ]
  const member: Step[] = [
    { k: "allow", name: "Set your allowlist", body: `Pick the work apps and sites ${APP} may see.`, done: t("allow"), tab: "settings" },
    { k: "ci", name: "Take the Culture Intelligence survey", body: "About 10 minutes. It places you on the team's Fit Map.", done: s.ciSurvey || legacy, auto: true },
    { k: "faq", name: `See what ${APP} records from you`, body: "Where your data comes from, what's tracked, what never is, and how to pause.", done: t("faq"), tab: "how" },
  ]
  // Members (owner direction 2026-10-30): sign in with Slack and agree, then 1 download the app,
  // 2 verification check, 3 Chrome extension, 4 the interview. Allowlist and survey come later.
  if (role === "Member") return [all[0], all[1],
    { ...all[2], name: `Download the ${APP} app`, body: "For your work Mac. About 3 minutes; it signs you in with Slack." },
    { ...all[3], name: "Run the verification check", body: "We confirm the app is connected and the 3 Mac permissions are on.", auto: false },
    { k: "extension", name: "Add the Chrome extension", body: "This will let us know which profile we should focus on when it comes to your work, and we can avoid looking at any other profiles.", done: s.extension ?? ((inst || legacy) && s.permissions !== false) },
    { ...all[4], name: "Do your 5-minute AI interview", body: "Five questions about your work, by voice. You approve the summary before anyone sees it." }]
  return [...all, ...(role === "Owner" ? owner : role === "Manager" ? manager : member)]
}

export const onboardingDone = (c: Client, s: Seat, role: Role, today: string) => onboardingSteps(c, s, role, today).every((x) => x.done)

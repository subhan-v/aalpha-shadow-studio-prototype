// The Trivium pilot (real numbers). Internal staging only: the public demo build aliases
// "@/lib/pilot" to ./pilot-none (see next.config.ts), so none of this reaches the demo bundle.
import { addDays } from "./dates"
import { agents, enrich, type Base } from "./seed"
import type { Client, ISODate, State } from "./types"

/** Trivium pilot: Mina's agency. Team roles from the Oct 14 onboarding call; numbers from his CEO report
 *  and the command-view spec (Slack window Jul 19 to Oct 18, desktop Oct 14 to 19). Aggregates only. */
export function pilot(t: ISODate): Client | null {
  const roles = ["CEO", "COO", "Video editor", "CSM", "Ads manager", "Sales lead", "Account manager", "Account manager", "Media buyer", "Designer", "Ops"]
  const names = ["Mina", "COO", "Video editor", "CSM", "Ads manager", "Sales lead", "Account manager 1", "Account manager 2", "Media buyer", "Designer", "Ops"]
  const b: Base = {
    id: "trivium", name: "Trivium (pilot)", owner: "Subhan", plan: "monthly",
    signedDate: addDays(t, -16), kickoffBooked: addDays(t, -12), kickoffDate: addDays(t, -12),
    agreementSigned: true, paymentIn: true, baselineSigned: addDays(t, -12), goalsCaptured: true, slackConnected: true,
    viktorAccess: addDays(t, -12), readoutDay: 21, readoutAttended: false, day90Attended: false, usagePct: null,
    foundTarget: 42, costPerSeatDay: 1.9,
    seats: roles.map((r, i) => ({ id: `trivium-s${i + 1}`, name: names[i], role: r, installAt: i < 6 ? addDays(t, -12) : i < 9 ? addDays(t, -6) : null, consent: true, ciSurvey: i < 6, ...(i === 0 ? { silentFrom: addDays(t, -4), silentTo: addDays(t, -3) } : {}) })),
    agents: agents("tri", [[14, 6], [24, 6], [30, 5], [40, 5], [46, 5], [52, 4], [58, 4], [64, 4], [70, 3], [76, 3], [82, 3], [86, 3], [88, 2]]),
    pauses: [], updatesSent: [addDays(t, -10), addDays(t, -3)], workflowsPublished: true, renewalOpened: false,
    linearKey: "TRI", slackSlug: "trivium", log: [{ date: addDays(t, -12), text: "Kickoff with Mina. Slack and desktop installed; 5 team members invited." }],
  }
  const c = enrich(b, t, { payroll: "csv", published: 10, goals: "published", sops: "draft" })
  // Pilot: everyone already went through setup, so nobody is held at Get started.
  c.prefs = Object.fromEntries(c.seats.map((x) => [x.id, { pausedUntil: null, start: null, end: null, block: [], allow: [], checklist: ["complete"] }]))
  c.pay[c.seats[0].id] = 1000
  c.pilot = {
    label: "Pilot data from Mina's CEO report: Slack Jul 19 to Oct 18, desktop Oct 14 to 19",
    sales: { leads: 36, within5m: 0, medianReplyH: 5.7, replied: 7, booked: 4, untouched: 27, untouchedBig: 13 },
    redZone: { deals: 39, withNext: 0, closedLater: 5, open: 34, over14d: 8 },
    signed: { quotes: 48, value: 164400, avg: 4110, loggedWrong: 19, loggedWrongValue: 73400, ceoTagged: 22 },
    customers: { channels: 11, quiet30: 4, down30: 3, up: 1 },
    clientResults: { last4: 247, prior4: 250, auditPausedSince: "Aug 31" },
    team: { posted: 40, topShare: 32, tasks: 1227, tasksFinished: 263 },
    ceo: { hoursObserved: 8, messagesPct: 41, meetingsPct: 28, longestFocusMin: 15, medianStretchSec: 12, afterHoursPct: 37, botMentionsPct: 80, valuePerHour: 1000, asks6mo: 69, asksToViktor: 21, asksToCoo: 12 },
    collected: { uploads: 11522, events: 33275, slackMessages: 35179, channels: 68 },
  }
  c.goals = [
    { id: "trivium-g1", title: "Answer every new lead within 5 minutes", metric: "Sales hours back a week", target: 4, categories: ["Sales"], status: "published" },
    { id: "trivium-g2", title: "Get Mina out of the inbox", metric: "Hours back a week", target: 6, categories: ["Ops and admin", "Client delivery"], status: "published" },
    { id: "trivium-g3", title: "Keep every product customer active", metric: "Hours back a week", target: 3, categories: ["Client delivery"], status: "published" },
  ]
  return c
}

export const PILOT_REQUESTS = (t: ISODate): State["requests"] => [
    { id: "r4", clientId: "trivium", from: "Mina (Trivium)", source: "Client app", kind: "Change", title: "Add a dropdown to filter by team member", detail: "From the Oct 14 call: see each person's numbers.", created: addDays(t, -12), status: "Done", priority: "Normal", assignee: "Hashim", linear: { id: "SHA-131", state: "Done" }, thread: [] },
]

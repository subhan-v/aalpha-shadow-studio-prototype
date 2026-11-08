// Bugs: one list in Studio, mirrored both ways with Linear. Studio creates the Linear issue and
// links it; Linear owns the status, and a webhook moves it here (simulated in the prototype).
// Severity sets the response time. A client who reported a bug gets the fix in their Slack thread.

import { addDays, diffDays } from "./dates"
import type { Bug, BugArea, ISODate, Request, State } from "./types"

export const SEVERITY: Record<Bug["severity"], { label: string; within: string; days: number }> = {
  P0: { label: "Privacy or data leak", within: "Same day", days: 1 },
  P1: { label: "Broken flow", within: "48 hours", days: 2 },
  P2: { label: "Wrong number", within: "Next weekly release", days: 7 },
  P3: { label: "Copy and polish", within: "Batched", days: 30 },
}
export const AREAS: BugArea[] = ["Capture", "Pipeline", "Slack", "Connectors", "Client app", "Studio", "Demo"]
export const FLOW: Bug["status"][] = ["Triage", "Todo", "In progress", "In review", "Done"]
export const RELEASE = "v18.1" // the next weekly release in the prototype

export const isOpenBug = (b: Bug) => b.status !== "Done" && b.status !== "Canceled"
/** Past its response time for the severity. */
export const late = (b: Bug, today: ISODate) => isOpenBug(b) && diffDays(today, b.reported) > SEVERITY[b.severity].days

const nextLinear = (s: State) => `SHA-${(s.linearSeq ?? 150) + 1}`

export function newBug(s: State, b: Pick<Bug, "title" | "detail" | "clientId" | "area" | "severity" | "source" | "assignee"> & { requestId?: string | null; clientRaised?: boolean }): State {
  const linearId = nextLinear(s)
  const bug: Bug = { ...b, id: `b${Date.now()}`, linearId, status: "Triage", reported: s.today, closed: null, release: null, testAdded: false, requestId: b.requestId ?? null, clientRaised: !!b.clientRaised, reply: null, history: [{ at: s.today, text: `Created in Studio by ${s.me}; Linear issue ${linearId} opened and linked.` }] }
  return { ...s, linearSeq: (s.linearSeq ?? 150) + 1, bugs: [bug, ...(s.bugs ?? [])] }
}

/** A request about something broken becomes a bug, linked both ways. */
export function bugFromRequest(s: State, r: Request): State {
  const area: BugArea = r.source === "Alert" ? "Pipeline" : r.source === "Slack" ? "Slack" : r.source === "Team" ? "Studio" : "Client app"
  const severity: Bug["severity"] = r.priority === "Urgent" ? "P1" : r.priority === "High" ? "P2" : "P3"
  const source: Bug["source"] = r.source === "Alert" ? "Alert" : r.source === "Slack" ? "Slack" : r.source === "Team" ? "Studio" : "Help chat"
  return newBug(s, { title: r.title, detail: r.detail, clientId: r.clientId, area, severity, source, assignee: r.assignee, requestId: r.id, clientRaised: r.source === "Client app" || r.source === "Member" || r.source === "Slack" })
}

/** Simulates the Linear webhook: the issue moved one step. On Done, the fix ships in the next
 *  release, and a client-raised bug gets its answer in the client's Slack thread. */
export function linearUpdated(s: State, id: string): State {
  const bugs = (s.bugs ?? []).map((b) => {
    if (b.id !== id || !isOpenBug(b)) return b
    const status = FLOW[Math.min(FLOW.indexOf(b.status) + 1, FLOW.length - 1)]
    const done = status === "Done"
    const reply = done && b.clientRaised ? `Thanks for flagging this. We fixed it, and the fix is live in ${RELEASE}: "${b.title.replace(/\.$/, "")}". Tell us if you still see it.` : b.reply
    return { ...b, status, closed: done ? s.today : null, release: done ? RELEASE : b.release, reply, history: [...b.history, { at: s.today, text: `Linear: ${b.linearId} moved to ${status}.` }, ...(done && b.clientRaised ? [{ at: s.today, text: "Reply sent to the client's Slack thread." }] : [])] }
  })
  return { ...s, bugs }
}

export const markTested = (s: State, id: string): State => ({ ...s, bugs: (s.bugs ?? []).map((b) => (b.id === id ? { ...b, testAdded: true, history: [...b.history, { at: s.today, text: "Regression test added." }] } : b)) })

/** Sample bugs for the prototype: a few open, and fixes from the v18 QA pass. */
export function sampleBugs(t: ISODate): Bug[] {
  const mk = (i: number, b: Partial<Bug> & Pick<Bug, "title" | "area" | "severity" | "status">): Bug => ({
    id: `bug${i}`, linearId: `SHA-${120 + i}`, detail: "", clientId: null, assignee: "Hashim", source: "QA", reported: addDays(t, -3), closed: null, release: null, testAdded: false, requestId: null, clientRaised: false, reply: null, history: [], ...b,
  })
  return [
    mk(1, { title: "Vision backlog not visible anywhere", area: "Pipeline", severity: "P1", status: "In progress", source: "Alert", reported: addDays(t, -2), detail: "45,373 analyses pending, oldest Sep 18. Needs the Platform backlog card and alert." }),
    mk(2, { title: "Slack member matched to the wrong person when emails differ in case", area: "Slack", severity: "P0", status: "Todo", source: "QA", reported: t, detail: "Identity fixture: one person, three identities. Two resolve to different people." }),
    mk(3, { title: "Weekly Progress Update shows last week's hours", area: "Client app", severity: "P2", status: "Triage", clientId: "northline", source: "Help chat", clientRaised: true, assignee: "AI specialist", reported: addDays(t, -1), detail: "From the owner in the help chat." }),
    mk(4, { title: "Tour card covers the bottom of long sections on a laptop", area: "Demo", severity: "P3", status: "Todo", reported: addDays(t, -1) }),
    mk(5, { title: "Pausing for today reset setup progress", area: "Client app", severity: "P1", status: "Done", reported: addDays(t, -1), closed: t, release: "v18", testAdded: true }),
    mk(6, { title: "Repeat-work hours differed between Overview and How it works", area: "Client app", severity: "P2", status: "Done", reported: addDays(t, -1), closed: t, release: "v18", testAdded: true }),
    mk(7, { title: "Owner saw personal goal text in the roll-up", area: "Client app", severity: "P0", status: "Done", reported: addDays(t, -1), closed: t, release: "v18", testAdded: true }),
    mk(8, { title: "Pod D (2 people) shown on its own", area: "Client app", severity: "P0", status: "Done", reported: addDays(t, -1), closed: t, release: "v18", testAdded: false }),
    mk(9, { title: "Agent flag sent with an empty note", area: "Client app", severity: "P3", status: "Done", clientId: "larkspur", source: "Help chat", clientRaised: true, reported: addDays(t, -4), closed: addDays(t, -1), release: "v18", testAdded: true, reply: "Fixed in v18: the Send button now waits for a note. Thanks for flagging it." }),
  ]
}

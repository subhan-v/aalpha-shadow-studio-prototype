// Recording follow-up for owners: who is recording, who isn't and why, measured against each
// person's own schedule. Status only, never what anyone was doing. The reasons follow the
// onboarding autopilot's steps, so an owner's nudge and Subhan's automated ones line up.

import { scheduleFor } from "./client-data"
import { addDays, diffDays, fmt, weekday } from "./dates"
import { installed, silent } from "./engine"
import { journey } from "./onboarding"
import { hasConsent } from "./consent"
import type { Client, ISODate, Seat, Send, State } from "./types"

// Standard work hours, for measuring someone whose own hours are 24/7.
const WORK = { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }

export type RecStatus = "Recording" | "Paused" | "Quiet 3+ days" | "Permissions missing" | "No consent" | "Not installed" | "Invited, not joined" | "On leave" | "Excluded"

export const STATUS_ORDER: RecStatus[] = ["Invited, not joined", "No consent", "Not installed", "Permissions missing", "Quiet 3+ days", "Paused", "Recording", "On leave", "Excluded"]

/** Weekdays after `from` up to and including `to`. */
export function workingDays(from: ISODate, to: ISODate) {
  let n = 0
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (weekday(d) !== 0 && weekday(d) !== 6) n++
  return n
}

export function recStatus(c: Client, s: Seat, today: ISODate): { status: RecStatus; since: ISODate | null; attention: boolean } {
  if (s.away === "leave") return { status: "On leave", since: null, attention: false }
  if (s.away === "excluded") return { status: "Excluded", since: null, attention: false }
  const j = journey(c, s, today)
  if (!j || j.stage === "invite") return { status: "Invited, not joined", since: j?.since ?? null, attention: !!j }
  // Without consent on the current form nothing is recorded, whatever else is set up.
  if (!hasConsent(c, s)) return { status: "No consent", since: null, attention: true }
  if (j.stage === "install") return { status: "Not installed", since: j.since, attention: true }
  if (j.stage === "permissions") return { status: "Permissions missing", since: j.since, attention: true }
  // Pausing is allowed. It only needs a word after 3 working days.
  if (s.pausedFrom && s.pausedFrom <= today) return { status: "Paused", since: s.pausedFrom, attention: workingDays(s.pausedFrom, today) >= 3 }
  // A person's own "pause for today" from My time or the menu bar.
  if (c.prefs[s.id]?.pausedUntil && c.prefs[s.id]!.pausedUntil! > today) return { status: "Paused", since: today, attention: false }
  if (silent(s, today) && s.silentFrom && diffDays(today, s.silentFrom) >= 3) return { status: "Quiet 3+ days", since: s.silentFrom, attention: true }
  return { status: "Recording", since: null, attention: false }
}

// Hours between two times; an end before the start runs past midnight (a night shift).
const hoursIn = (start: string, end: string) => { const d = Number(end.slice(0, 2)) + Number(end.slice(3)) / 60 - Number(start.slice(0, 2)) - Number(start.slice(3)) / 60; return d < 0 ? d + 24 : d }

/** Share of a group's scheduled working hours that Shadow captured over the last 7 days. */
export function captured(c: Client, seats: Seat[], today: ISODate) {
  let sched = 0
  let got = 0
  for (const s of seats) {
    if (s.away) continue
    // Someone on 24/7 is measured against the team's normal hours, so round-the-clock
    // recording doesn't count every night and weekend as missed time.
    const own = scheduleFor(c, s.id)
    const team = c.capture.start === "00:00" && c.capture.end === "23:59" ? WORK : { days: c.capture.days, start: c.capture.start, end: c.capture.end }
    const sc = own.preset === "247" ? team : own
    const h = hoursIn(sc.start, sc.end)
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i)
      const wd = weekday(d) === 0 ? 7 : weekday(d)
      if (!sc.days.includes(wd)) continue
      sched += h
      const paused = c.prefs[s.id]?.pausedUntil
      const on = installed(s, d) && hasConsent(c, s) && s.permissions !== false && !silent(s, d) && !(s.pausedFrom && s.pausedFrom <= d) && !(paused && paused > d && d >= addDays(paused, -1))
      if (on) got += h
    }
  }
  return { pct: sched ? Math.round((got / sched) * 100) : 0, sched: Math.round(sched), got: Math.round(got) }
}

const first = (s: Seat) => s.name.split(" ")[0]

export function nudgeText(st: RecStatus, s: Seat, since: ISODate | null) {
  const when = since ? fmt(since) : "last week"
  return {
    "Invited, not joined": `Hi ${first(s)}, can you set up Shadow today? It takes about 3 minutes and the link is in your email.`,
    "Not installed": `Hi ${first(s)}, Shadow isn't on your Mac yet. The link is in your email and it takes 3 minutes.`,
    "No consent": `Hi ${first(s)}, please read and agree to the Shadow consent form in your Get started. Nothing is recorded until you do.`,
    "Permissions missing": `Hi ${first(s)}, Shadow needs its 3 Mac permissions: Screen Recording, Accessibility and Input Monitoring. System Settings > Privacy & Security.`,
    "Paused": `Hi ${first(s)}, Shadow has been paused since ${when}. Can you turn it back on when you're on work?`,
    "Quiet 3+ days": `Hi ${first(s)}, Shadow has been quiet on your Mac since ${when}. Can you reopen it from the menu bar?`,
    Recording: "", "On leave": "", Excluded: "",
  }[st]
}

/** Every message sent to one person, newest first: Subhan's automated ones and the owner's own. */
export const timeline = (s: State, c: Client, seatId: string) => s.sends.filter((x) => x.clientId === c.id && x.seatIds.includes(seatId)).sort((a, b) => b.at.localeCompare(a.at))

/** Nobody gets the same nudge twice in two days. */
export const nudgedRecently = (s: State, c: Client, seatId: string) => timeline(s, c, seatId).some((x) => diffDays(s.today, x.at) < 2)

export function nudge(p: State, c: Client, seats: { seat: Seat; status: RecStatus; since: ISODate | null }[], by: string): State {
  const sends: Send[] = seats.map(({ seat, status, since }, i) => ({ id: `nd${Date.now()}${i}`, clientId: c.id, seatIds: [seat.id], stepId: `owner:${status}`, at: p.today, status: "Sent", by, body: nudgeText(status, seat, since) }))
  return { ...p, sends: [...sends, ...p.sends], clients: p.clients.map((x) => (x.id === c.id ? { ...x, log: [{ date: p.today, text: `${by} nudged ${seats.length === 1 ? seats[0].seat.name : `${seats.length} people`} about recording.` }, ...x.log] } : x)) }
}

/** One count of who is recording, used by every page: people not on leave or excluded, and how
 *  many of them are recording (a pause counts) or need attention. Same rule as the Team page. */
export function recordingNow(c: Client, seats: Seat[], today: ISODate) {
  const active = seats.filter((s) => !s.away)
  const rows = active.map((s) => ({ s, ...recStatus(c, s, today) }))
  return { on: rows.filter((r) => r.status === "Recording" || r.status === "Paused").length, of: active.length, attention: rows.filter((r) => r.attention), rows }
}

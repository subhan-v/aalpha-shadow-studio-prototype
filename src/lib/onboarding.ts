// Onboarding autopilot. Every person moves through five steps (accept the invite, install,
// grant permissions, start recording, live for 3 days). The sequence is a ladder of messages
// per step, fired by how long someone has been stuck. Auto messages send themselves, Approve
// ones wait for a click, Manual ones are tasks with how-to steps. Everything automated comes
// from Subhan for now. A question in Slack that matches Common questions adds a reply to approve. Journey dates are derived from the sample seats.

import { addDays, diffDays, hash } from "./dates"
import { installed, silent } from "./engine"
import { faq } from "./faq"
import { slackMessages } from "./slack"
import { churned } from "./renewal"
import type { Client, ISODate, JourneyStage, Seat, SeqStep, State } from "./types"

export const STEPS: { id: JourneyStage; label: string; short: string }[] = [
  { id: "invite", label: "Accept the invite", short: "Invited" },
  { id: "install", label: "Install the app", short: "Joined" },
  { id: "permissions", label: "Grant permissions", short: "Installed" },
  { id: "extension", label: "Add the extension", short: "Checked" },
  { id: "interview", label: "Do the interview", short: "Extension on" },
  { id: "recording", label: "Start recording", short: "Interviewed" },
  { id: "live", label: "Live", short: "Live" },
]

// Short, one idea per message, written as Subhan. The welcome answers the own-laptop worry
// up front, because that is the question that stalls installs.
export const SEQUENCE: SeqStep[] = [
  // The invite (owner direction 2026-10-30): warm, why it helps them, the link, then every disclosure.
  { id: "inv-hello", stage: "invite", after: 0, name: "Invite with disclosures", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {first}, I'm {sender} from Aalpha. {owner} brought us in to take the repetitive busywork off the team's plate. I'd like your help, so we can let you work on the things that matter and not the work that is boring and repetitive.\n\nClick here to sign in with Slack and follow the steps. It'll take 10 minutes: {link}\nWant to see it first? 2-minute video: {video}\n\nBy the way, Shadow tracks a few things to help us find patterns: screenshots at intervals, plus the app, site and clicks, only for the work apps and sites on your allowlist, and what you post in public Slack channels and the private channels {owner} is in. We're not here to monitor you, and it isn't used for decisions about your job. All we care about is finding the work you do today and how to help you do it better.\n\nIt never records video, never uses your mic or camera, and never reads your direct messages. You can pause any time, set your own hours, and keep apps and sites out of it. Everything stays on your computer first and gets filtered there, so private info is redacted before anything comes to us.\n\nAny questions, just reply here. I read every one." },
  { id: "inv-owner-dm", stage: "invite", after: 24, name: "Note from the client's owner", channel: "Slack DM", from: "Client owner", mode: "Approve", on: true,
    body: "Hey {first}, set up Shadow when you get a sec: {link}. It's how we find the busywork to hand to AI. You pick which apps it tracks." },
  { id: "inv-nudge", stage: "invite", after: 72, name: "Quick check-in", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {first}, just checking my note reached you. Whenever you have 10 minutes: {link}\nIf anything about Shadow worries you, ask me here first. Happy to answer." },
  { id: "inv-owner-list", stage: "invite", after: 96, name: "Tell the owner who hasn't joined", channel: "Owner DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {owner}, {count} haven't joined Shadow yet: {names}. A quick word from you usually does it." },
  { id: "inv-call", stage: "invite", after: 168, name: "A week without joining: reach out", channel: "Call", from: "Sender", mode: "Manual", on: true,
    body: "Hi {first}, want to set up Shadow together? 10 minutes, and I'll answer anything on your mind.",
    howTo: ["Send the message below in Slack.", "Ask what's holding them back. Usually it's their own laptop: use Common questions.", "No answer in a day? Ask the owner who can help."] },

  { id: "ins-guide", stage: "install", after: 1, name: "Signed in, app next", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Nice, you're signed in, {first}. Next is the Shadow app for your Mac: {link}\nThe guide walks you through it. About 3 minutes." },
  { id: "ins-dm", stage: "install", after: 24, name: "Anything in the way?", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {first}, the app isn't on your Mac yet. Anything in the way? Reply here and I'll sort it out with you." },
  { id: "ins-owner", stage: "install", after: 48, name: "Tell the owner who hasn't installed", channel: "Owner DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {owner}, {count} joined but haven't installed: {names}. Results start at install, so this is the one to push." },
  { id: "ins-call", stage: "install", after: 72, name: "10-minute install call", channel: "Call", from: "Sender", mode: "Manual", on: true,
    body: "Hi {first}, can we grab 10 minutes today? We'll set up Shadow together and pick what it tracks.",
    howTo: ["Book 10 minutes.", "Share the install link before the call.", "Download, sign in with Slack, then the 3 Mac permissions.", "Set their allowlist together if it's their own laptop.", "Stay on until Activity shows their first upload."] },

  { id: "per-fix", stage: "permissions", after: 2, name: "Turn on permissions", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Almost there, {first}. The check says a Mac permission is still off. In System Settings > Privacy & Security, switch Shadow on under Screen Recording, Accessibility and Input Monitoring, then run the check again." },
  { id: "per-call", stage: "permissions", after: 24, name: "Fix permissions together", channel: "Call", from: "Sender", mode: "Manual", on: true,
    body: "Hi {first}, Shadow's installed but can't record yet. 5 minutes to switch on the permissions together?",
    howTo: ["Check Activity for which permission is missing.", "On a company laptop, IT may need to allow it.", "Mark done once the device reports the permissions."] },

  // New stages (v19.4): people stuck on the Chrome extension or the interview get their own note.
  { id: "ext-dm", stage: "extension", after: 4, name: "Chrome extension left", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {first}, one small step left: the Chrome extension, in your work profile. It tells us which profile is for work, so we leave your other profiles alone. {link}" },
  { id: "ext-call", stage: "extension", after: 48, name: "Do the extension together", channel: "Slack DM", from: "Sender", mode: "Approve", on: true,
    body: "Hi {first}, the Chrome extension still isn't on. Want to do it together? Reply with a time and I'll send a 5-minute call link." },
  { id: "int-dm", stage: "interview", after: 12, name: "Interview left", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {first}, last step: your 5-minute interview. Five questions about your work, and you approve the summary before anyone sees it. Whenever suits you today: {link}" },
  { id: "int-dm2", stage: "interview", after: 72, name: "Interview, gentle second note", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {first}, no pressure on the interview. Your answers help us aim at the work you'd most like to hand off. Got 5 minutes today? {link}" },
  { id: "int-owner", stage: "interview", after: 120, name: "Tell the owner who hasn't done the interview", channel: "Owner DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {owner}, {count} haven't done their 5-minute interview yet: {names}. A quick nudge from you helps." },
  { id: "rec-nudge", stage: "recording", after: 4, name: "Gone quiet", channel: "Slack DM", from: "Sender", mode: "Auto", on: true,
    body: "Hi {first}, Shadow went quiet on your Mac. Paused, or closed by accident? Reopen it from the menu bar when you're back on work. No rush." },
  { id: "rec-check", stage: "recording", after: 24, name: "Check in", channel: "Call", from: "Sender", mode: "Manual", on: true,
    body: "Hi {first}, Shadow's been quiet since {since}. New laptop, or paused on purpose?",
    howTo: ["Check if they're on leave or changed laptops.", "If paused on purpose, ask the owner whether to leave them out.", "Mark done once data is flowing."] },

  { id: "con-reply", stage: "concern", after: 0, name: "Answer a question in Slack", channel: "Slack thread", from: "Sender", mode: "Approve", on: true,
    body: "Good question, {first}. {answer}" },
]

// Every message to a client is from Subhan (owner rule, 2026-10-30); the old specialist option is gone.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const senderName = (_s: State, _c: Client) => "Subhan"

export type Person = { seat: Seat; stage: JourneyStage; since: ISODate; hours: number; done: number }

/** Where one person is, and since when. Dates are derived from the sample seat. */
export function journey(c: Client, seat: Seat, today: ISODate): Person | null {
  if (!c.kickoffDate || c.kickoffDate > today) return null
  const invited = c.kickoffDate
  const h = hash(seat.id + "acc")
  const inst = installed(seat, today)
  const accepted: ISODate | null = inst ? (seat.installAt! > invited ? addDays(seat.installAt!, -(h > 0.5 ? 1 : 0)) : invited) : h > 0.35 ? addDays(invited, 1) : null
  let stage: JourneyStage
  let since: ISODate
  if (!accepted || accepted > today) { stage = "invite"; since = invited }
  else if (!inst) { stage = "install"; since = accepted }
  else if (seat.permissions === false) { stage = "permissions"; since = seat.installAt! }
  else if (seat.extension === false) { stage = "extension"; since = seat.installAt! }
  else if (silent(seat, today)) { stage = "recording"; since = seat.silentFrom! }
  else if (diffDays(today, seat.installAt!) < 3) { stage = "recording"; since = seat.installAt! }
  else { stage = "live"; since = addDays(seat.installAt!, 3) }
  // "recording" in its first 3 days just means warming up, not stuck.
  const warming = stage === "recording" && !silent(seat, today)
  const hours = warming ? 0 : diffDays(today, since) * 24 + 10
  return { seat, stage, since, hours, done: STEPS.findIndex((x) => x.id === stage) }
}

export function people(c: Client, today: ISODate) {
  return c.seats.map((x) => journey(c, x, today)).filter((x): x is Person => !!x)
}

export function funnel(c: Client, today: ISODate) {
  const ps = people(c, today)
  return STEPS.map((st, i) => ({ ...st, reached: ps.filter((p) => p.done >= i).length, stuck: ps.filter((p) => p.done === i && p.stage !== "live").length, of: ps.length }))
}

export type Item = { key: string; client: Client; step: SeqStep; persons: Person[]; due: ISODate; text: string; status: "due" | "scheduled"; quote?: string }

const fill = (st: SeqStep, c: Client, ps: Person[], sender: string, answer = "") =>
  st.body
    .replaceAll("{sender}", sender)
    .replaceAll("{answer}", answer)
    .replaceAll("{faq}", "shadow.so/faq")
    .replaceAll("{first}", ps[0]?.seat.name.split(" ")[0] ?? "there")
    .replaceAll("{owner}", c.seats[0]?.name.split(" ")[0] ?? "Your owner")
    .replaceAll("{count}", String(ps.length))
    .replaceAll("{names}", ps.map((p) => p.seat.name).join(", "))
    .replaceAll("{since}", ps[0]?.since.slice(5) ?? "")
    .replaceAll("{link}", "shadow.so/i/" + c.id) // opens /join/<client> in the prototype
    .replaceAll("{video}", "shadow.so/v/welcome")

/** What the sequence wants to send for one client: due now, and the next one scheduled per person. */
export function outbox(s: State, c: Client): Item[] {
  const t = s.today
  if (churned(c, t)) return []
  // The interview doesn't stop recording, so it isn't a journey stage: anyone who installed in the
  // last 2 weeks without doing it gets its own notes, and "Live" counts stay as they were.
  const interviewing: Person[] = c.seats.filter((x) => installed(x, t) && x.permissions !== false && x.extension !== false && !x.interview && diffDays(t, x.installAt!) <= 14)
    .map((x) => ({ seat: x, stage: "interview" as const, since: x.installAt!, hours: diffDays(t, x.installAt!) * 24 + 10, done: STEPS.findIndex((y) => y.id === "interview") }))
  const ps = [...people(c, t).filter((p) => p.stage !== "live"), ...interviewing]
  const sent = new Set(s.sends.filter((x) => x.clientId === c.id).flatMap((x) => x.seatIds.map((id) => `${x.stepId}:${id}`)))
  const out: Item[] = []
  const who0 = senderName(s, c)
  const steps = s.sequence.filter((x) => x.on)
  // Only the latest message a person is due counts; earlier rungs went out on their day.
  const latest = (p: Person, owner: boolean) => steps.filter((x) => x.stage === p.stage && (x.channel === "Owner DM") === owner && p.hours >= x.after).sort((a, b) => b.after - a.after)[0]
  for (const p of ps) {
    const st = latest(p, false)
    if (st && !sent.has(`${st.id}:${p.seat.id}`)) out.push({ key: `${c.id}:${st.id}:${p.seat.id}`, client: c, step: st, persons: [p], due: t, text: fill(st, c, [p], who0), status: "due" })
  }
  // One note to the owner per step, naming everyone stuck there.
  for (const st of steps.filter((x) => x.channel === "Owner DM")) {
    const who = ps.filter((p) => latest(p, true)?.id === st.id && !sent.has(`${st.id}:${p.seat.id}`))
    if (who.length) out.push({ key: `${c.id}:${st.id}:${who.map((p) => p.seat.id).join(",")}`, client: c, step: st, persons: who, due: t, text: fill(st, c, who, who0), status: "due" })
  }
  // Next scheduled message per stuck person, so the team sees what's coming.
  for (const p of ps) {
    const next = steps.filter((x) => x.stage === p.stage && x.after > p.hours && x.channel !== "Owner DM").sort((a, b) => a.after - b.after)[0]
    if (next) out.push({ key: `${c.id}:${next.id}:${p.seat.id}:next`, client: c, step: next, persons: [p], due: addDays(p.since, Math.ceil((next.after - 10) / 24)), text: fill(next, c, [p], who0), status: "scheduled" })
  }
  // A worried Slack message from someone adds a reply for approval.
  const con = steps.find((x) => x.stage === "concern")
  if (con) {
    for (const m of slackMessages(c, t).filter((m) => m.faq && !m.answeredBy && !s.slack[m.id] && diffDays(t, m.at) <= 2)) {
      if (sent.has(`${con.id}:${m.seatId}`)) continue
      const p = journey(c, c.seats.find((x) => x.id === m.seatId)!, t)
      if (p && !out.some((o) => o.step.id === con.id && o.persons[0].seat.id === p.seat.id)) out.push({ key: `${c.id}:${con.id}:${p.seat.id}`, client: c, step: con, persons: [p], due: t, text: fill(con, c, [p], who0, faq(m.faq!).a), status: "due", quote: m.text })
    }
  }
  return out
}

/** Sample effectiveness per message: how many people moved on to the next step within 48 hours. */
export function effectiveness(st: SeqStep) {
  const h = hash(st.id + "eff")
  const sent = 6 + Math.floor(h * 40)
  const base = st.channel === "Call" ? 0.78 : st.from === "Client owner" ? 0.52 : st.channel === "Email" ? 0.22 : 0.38
  const rate = Math.min(0.95, Math.max(0.05, base + (hash(st.id + "r") - 0.5) * 0.16))
  return { sent, rate: Math.round(rate * 100), medianHrs: Math.round(6 + (1 - rate) * 40) }
}

/** Record a send, skip or done. A manual call marked done moves the person on, as it would for real. */
export function act(s: State, it: Item, status: "Sent" | "Skipped" | "Done", body = it.text): State {
  const ids = it.persons.map((p) => p.seat.id)
  const t = s.today
  const word = status === "Skipped" ? "Skipped" : status === "Done" ? "Done" : "Sent"
  const send = { id: `snd${Date.now()}${Math.floor(Math.random() * 1000)}`, clientId: it.client.id, seatIds: ids, stepId: it.step.id, at: t, status, by: s.me, body }
  const clients = s.clients.map((c) => {
    if (c.id !== it.client.id) return c
    const seats = c.seats.map((x) => {
      if (!ids.includes(x.id)) return x
      // A call that fixes the install or permissions never stands in for consent.
      if (status === "Done" && it.step.stage === "install") return { ...x, installAt: t }
      if (status === "Done" && it.step.stage === "permissions") return { ...x, permissions: true }
      if (status === "Done" && it.step.stage === "recording") return { ...x, silentTo: t }
      if (status === "Done" && it.step.stage === "invite") return { ...x, nudgedAt: t }
      return status === "Sent" ? { ...x, nudgedAt: t } : x
    })
    return { ...c, seats, log: [{ date: t, text: `${word}: ${it.step.name} (${it.persons.map((p) => p.seat.name).join(", ")}).` }, ...c.log] }
  })
  let slack = s.slack
  if (it.step.stage === "concern" && status !== "Skipped") {
    slack = { ...slack }
    for (const m of slackMessages(it.client, t).filter((m) => m.faq && ids.includes(m.seatId ?? ""))) slack[m.id] = { status: "Replied", by: s.me, at: t, reply: body }
  }
  return { ...s, clients, slack, sends: [send, ...s.sends] }
}

/** Items that wait on a person, grouped so one click can approve the same message for a whole team. */
export function decisions(s: State, items: Item[]) {
  const due = items.filter((x) => x.status === "due" && (x.step.mode !== "Auto" || s.autopilot[x.client.id] === false))
  const groups = new Map<string, Item[]>()
  for (const it of due) {
    // Answers to Slack questions differ per question, so they never batch.
    const k = it.step.stage === "concern" ? it.key : `${it.client.id}:${it.step.id}`
    groups.set(k, [...(groups.get(k) ?? []), it])
  }
  return [...groups.values()]
}

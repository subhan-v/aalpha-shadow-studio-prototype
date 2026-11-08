// Slack: every message in each client's shared channel, scored for sentiment and tagged by
// topic, so the team sees one queue and how each channel feels. Sample messages, stable per
// client and day, weighted by where the client is (install worries early, results later).
// The real build reads the Slack connection Shadow already has and scores with a model.

import { addDays, diffDays, hash } from "./dates"
import { dayN, installed } from "./engine"
import { faq } from "./faq"
import type { Client, ISODate, State } from "./types"
import { APP } from "@/lib/flags"

export type Topic = "Privacy" | "Install" | "Question" | "Praise" | "Problem" | "Thanks"
export type SlackMsg = { id: string; clientId: string; channel: string; at: ISODate; time: string; from: string; seatId: string | null; text: string; topic: Topic; score: number; needsReply: boolean; answeredBy: string | null; faq?: string }

// Install-time questions are the ones Kim asked at Trivium before installing on her own laptop.
const LINES: { topic: Topic; score: number; text: string; reply: boolean; early: boolean; faq?: string }[] = [
  { topic: "Privacy", score: -0.6, early: true, reply: true, faq: "own-laptop", text: "This is my own laptop, not the company's. Will it only track work stuff?" },
  { topic: "Privacy", score: -0.5, early: true, reply: true, faq: "captures", text: "Is it taking screenshots or recording my screen?" },
  { topic: "Privacy", score: -0.4, early: true, reply: true, faq: "chrome", text: "Can I keep my personal Chrome profile out of it?" },
  { topic: "Privacy", score: -0.3, early: true, reply: true, faq: "pause", text: "Can I pause it outside work hours?" },
  { topic: "Install", score: -0.2, early: true, reply: true, faq: "permissions", text: "What system permissions does it need exactly?" },
  { topic: "Question", score: 0, early: true, reply: true, faq: "guide", text: "Is there a user guide or docs I can read first?" },
  { topic: "Install", score: -0.4, early: true, reply: true, text: `${APP} closes every time I restart my Mac` },
  { topic: "Question", score: 0, early: false, reply: true, text: "Where do I see my own report?" },
  { topic: "Praise", score: 0.8, early: false, reply: false, text: "This morning's report was actually useful. Didn't realise I spend 6 hours a week on status updates" },
  { topic: "Praise", score: 0.9, early: false, reply: false, text: "The client report agent saved me an hour today" },
  { topic: "Problem", score: -0.5, early: false, reply: true, text: "The client report draft pulled last month's numbers" },
  { topic: "Thanks", score: 0.4, early: true, reply: false, text: "Done, it's installed" },
  { topic: "Thanks", score: 0.5, early: true, reply: false, text: "Thanks, that answers it" },
]

/** Default reply: the approved Common questions answer when there is one, else a short holding line. */
export function suggestedReply(m: SlackMsg) {
  if (m.faq) return `Good question. ${faq(m.faq).a}`
  return {
    Install: "Thanks for flagging. I'll DM you a fix, and if it's still stuck we'll do a 5-minute screen share.",
    Question: "Good question. I'll DM you a short answer with a screenshot.",
    Problem: "Thanks for catching that. I've logged it with the build team and will update you here.",
    Praise: "Love hearing that. Thank you.",
    Thanks: "Great, thank you.",
    Privacy: "Good question. I'll DM you the details.",
  }[m.topic]
}

export function slackMessages(c: Client, today: ISODate): SlackMsg[] {
  const n = dayN(c, today)
  if (n === null) return []
  const people = [...c.seats.slice(0, 8)]
  const out: SlackMsg[] = []
  for (let back = 0; back < 7; back++) {
    const day = addDays(today, -back)
    const dn = n - back
    if (dn < 0) break
    const count = 1 + Math.floor(hash(`${c.id}${day}n`) * (dn < 14 ? 5 : 3))
    for (let i = 0; i < count; i++) {
      const h = hash(`${c.id}${day}${i}`)
      const pool = LINES.filter((l) => (dn < 14 ? l.early || h > 0.85 : !l.early || h > 0.8))
      const line = pool[Math.floor(hash(`${c.id}${day}${i}l`) * pool.length)]
      const who = people[Math.floor(h * people.length)]
      // Install worries come from people who haven't installed; praise from those who have.
      if (line.topic === "Install" && installed(who, day)) continue
      if (line.topic === "Praise" && !installed(who, day)) continue
      if (out.some((m) => m.seatId === who.id && m.text === line.text)) continue
      // The demo agency is a happy mid-engagement client: most worries were settled weeks ago.
      if (c.demo && line.score < 0 && h < 0.95) continue
      out.push({
        id: `${c.id}-${day}-${i}`, clientId: c.id, channel: `${c.slackSlug}-shadow`, at: day,
        time: `${9 + Math.floor(h * 8)}:${String(Math.floor(hash(`${day}${i}m`) * 60)).padStart(2, "0")}`,
        from: who.name, seatId: who.id, text: line.text, topic: line.topic, score: line.score, needsReply: line.reply, faq: line.faq,
        // Older threads were mostly answered already; a few slip through, which is the point of the queue.
        answeredBy: line.reply && back >= 2 && hash(`${c.id}${day}${i}a`) > 0.2 ? c.owner : null,
      })
    }
  }
  return out.sort((a, b) => (a.at === b.at ? b.time.localeCompare(a.time, undefined, { numeric: true }) : b.at.localeCompare(a.at)))
}

export const isOpen = (s: State, m: SlackMsg) => m.needsReply && !m.answeredBy && !s.slack[m.id]
/** A recent FAQ question already has a drafted reply waiting in Onboarding, so it is counted there, not here. */
export const draftedInOnboarding = (s: State, m: SlackMsg) => !!m.faq && diffDays(s.today, m.at) <= 2
/** Open messages that need someone in Slack itself: what the badges count. */
export const needsYou = (s: State, m: SlackMsg) => isOpen(s, m) && !draftedInOnboarding(s, m)

/** Channel mood: -100 to 100 over the last 7 days, the daily trend, and what people worry about. */
export function sentiment(c: Client, s: State) {
  const msgs = slackMessages(c, s.today)
  const score = msgs.length ? Math.round((msgs.reduce((n, m) => n + m.score, 0) / msgs.length) * 100) : 0
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(s.today, i - 6)
    const day = msgs.filter((m) => m.at === d)
    return { d, score: day.length ? Math.round((day.reduce((n, m) => n + m.score, 0) / day.length) * 100) : null, count: day.length }
  })
  const topics = (["Privacy", "Install", "Problem", "Question", "Praise", "Thanks"] as Topic[]).map((t) => ({ t, n: msgs.filter((m) => m.topic === t).length })).filter((x) => x.n)
  const worries = msgs.filter((m) => m.score < -0.2)
  const label = score >= 25 ? "Positive" : score > -15 ? "Mixed" : "Worried"
  const first = days.find((x) => x.score !== null)?.score ?? 0
  const last = [...days].reverse().find((x) => x.score !== null)?.score ?? 0
  return { score, label, days, topics, worries, open: msgs.filter((m) => isOpen(s, m)).length, total: msgs.length, trend: last - first }
}

export const ageLabel = (at: ISODate, today: ISODate, time: string) => {
  const d = diffDays(today, at)
  return d === 0 ? time : d === 1 ? `Yesterday ${time}` : `${d}d ago`
}

"use client"

// One queue for every client Slack message, with each channel's mood. Reply with a suggested
// answer, close it, or turn it into a request (and from there, a Linear ticket).

import Link from "next/link"
import { useState } from "react"
import { Check, CornerDownRight, Hash, Inbox, MessageSquare, Send, TrendingDown, TrendingUp } from "lucide-react"
import { Pill, Section, Segmented, Shown } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { newRequest } from "@/lib/requests"
import { ageLabel, draftedInOnboarding, isOpen, sentiment, slackMessages, suggestedReply, type SlackMsg, type Topic } from "@/lib/slack"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"
import { cn } from "@/lib/utils"

export const TOPIC_C: Record<Topic, string> = { Privacy: "#e5484d", Install: "#eb6834", Problem: "#eda100", Question: "#2a78d6", Praise: "#1baf7a", Thanks: "#22a06b" }
const moodC = (score: number) => (score >= 25 ? "var(--status-good)" : score > -15 ? "var(--status-warning)" : "var(--status-critical)")

export function TopicBubble({ t }: { t: Topic }) {
  return <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium" style={{ background: `color-mix(in oklch, ${TOPIC_C[t]}, white 86%)`, color: `color-mix(in oklch, ${TOPIC_C[t]}, black 35%)` }}><span className="size-1.5 rounded-full" style={{ background: TOPIC_C[t] }} />{t}</span>
}

/** Mood of one client channel over the last 7 days. */
export function ChannelMood({ c, compact }: { c: Client; compact?: boolean }) {
  const { s } = useStore()
  const m = sentiment(c, s)
  const bars = (
    <div className="flex h-16 items-center gap-1.5" aria-label="Mood by day, last 7 days">
      {m.days.map((d) => (
        <div key={d.d} className="relative flex h-full flex-1 flex-col justify-center" title={`${d.d.slice(5)}: ${d.score ?? "no messages"}`}>
          <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" />
          {d.score !== null && <div className="mx-auto w-full max-w-5 rounded-[3px]" style={{ height: `${Math.max(3, Math.abs(d.score) / 2.2)}%`, background: moodC(d.score), transform: d.score >= 0 ? "translateY(-50%)" : "translateY(50%)" }} />}
        </div>
      ))}
    </div>
  )
  if (compact) return bars
  return (
    <Section title="Channel mood" sub={`#${c.slackSlug}-shadow · last 7 days · ${m.total} messages`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-4xl font-semibold tabular-nums" style={{ color: moodC(m.score) }}>{m.score > 0 ? "+" : ""}{m.score}</span>
            <span className="text-sm font-medium">{m.label}</span>
          </span>
          {m.days.filter((d) => d.score !== null).length >= 3 && <span className={cn("flex items-center gap-1 text-xs", m.trend >= 0 ? "text-[var(--delta-good)]" : "text-[var(--delta-bad)]")}>{m.trend >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{m.trend >= 0 ? "Warming up" : "Cooling"} this week</span>}
        </div>
        {bars}
        <div className="flex flex-wrap gap-1.5">{m.topics.map((x) => <span key={x.t} className="flex items-center gap-1"><TopicBubble t={x.t} /><span className="text-xs tabular-nums text-[var(--text-muted)]">{x.n}</span></span>)}</div>
        {m.worries.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <span className="text-xs text-[var(--text-muted)]">What people are worried about</span>
            {[...new Map(m.worries.map((w) => [w.text, w])).values()].slice(0, 3).map((w) => <p key={w.id} className="text-sm leading-snug">&ldquo;{w.text}&rdquo; <span className="text-xs text-[var(--text-muted)]">{w.from}</span></p>)}
          </div>
        )}
      </div>
    </Section>
  )
}

function MsgRow({ m, c, showClient }: { m: SlackMsg; c: Client; showClient: boolean }) {
  const { s, mutate } = useStore()
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState(suggestedReply(m))
  const h = s.slack[m.id] ?? (m.answeredBy ? { status: "Replied" as const, by: m.answeredBy, at: m.at } : undefined)
  const set = (status: "Replied" | "Done" | "Request", text?: string) => mutate((x) => {
    let n = { ...x, slack: { ...x.slack, [m.id]: { status, by: x.me, at: x.today, reply: text } } }
    if (status === "Request") n = newRequest(n, { clientId: c.id, from: m.from, source: "Slack", kind: m.topic === "Problem" ? "Bug" : "Question", title: m.text.slice(0, 80), detail: `From #${m.channel}: "${m.text}"`, priority: m.topic === "Problem" ? "High" : "Normal", assignee: c.owner })
    return n
  })
  return (
    <div className="flex flex-col gap-2 border-t px-5 py-3.5 first:border-t-0">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: TOPIC_C[m.topic] }} aria-hidden>{m.from.slice(0, 1)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
            <span className="text-sm font-medium text-[var(--text-primary)]">{m.from}</span>
            {showClient && <Link href={`/clients/${c.id}?tab=slack`} className="hover:underline">{c.name}</Link>}
            <span className="flex items-center gap-0.5"><Hash className="size-3" />{m.channel}</span>
            <span>{ageLabel(m.at, s.today, m.time)}</span>
            {isOpen(s, m) && draftedInOnboarding(s, m) && <Link href="/onboarding" className="rounded-full bg-[var(--seq-100)] px-2 py-0.5 text-[var(--seq-900)] hover:underline">Reply drafted in Onboarding</Link>}
          </span>
          <span className="text-sm leading-snug">{m.text}</span>
          <span className="flex flex-wrap items-center gap-2"><TopicBubble t={m.topic} />{h ? <Pill t={h.status === "Request" ? "info" : "good"}><Check className="size-3" />{h.status === "Request" ? "Made a request" : h.status} · {h.by}</Pill> : m.needsReply ? <Pill t="warn">Needs a reply</Pill> : null}</span>
          {h && "reply" in h && h.reply && <span className="flex gap-1.5 text-xs text-[var(--text-secondary)]"><CornerDownRight className="size-3.5 shrink-0" />{h.reply}</span>}
        </span>
        {!h && m.needsReply && <Button size="sm" variant={open ? "secondary" : "outline"} className="rounded-[10px]" onClick={() => setOpen(!open)}><MessageSquare />Reply</Button>}
      </div>
      {open && !h && (
        <div className="ml-11 flex flex-col gap-2">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} className="min-h-20 rounded-xl text-sm" aria-label="Reply" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-[10px]" onClick={() => set("Replied", reply)}><Send />Reply in thread</Button>
            <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => set("Request")}><Inbox />Make it a request</Button>
            <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => set("Done")}>No reply needed</Button>
          </div>
          <span className="text-xs text-[var(--text-muted)]">{m.faq ? "Approved answer from Common questions." : "Suggested reply."} Prototype: nothing is posted to Slack.</span>
        </div>
      )}
    </div>
  )
}

/** All Slack messages, or one client's. */
export function SlackQueue({ clientId }: { clientId?: string }) {
  const { s } = useStore()
  const [view, setView] = useState("open")
  const [ch, setCh] = useState<string | null>(null)
  const clients = s.clients.filter((c) => !clientId || c.id === clientId)
  const all = clients.flatMap((c) => slackMessages(c, s.today).map((m) => ({ m, c })))
  const shown = all
    .filter((x) => !ch || x.c.id === ch)
    .filter(({ m }) => (view === "open" ? isOpen(s, m) : view === "worried" ? m.score < -0.2 : true))
    .sort((a, b) => (a.m.at === b.m.at ? b.m.time.localeCompare(a.m.time, undefined, { numeric: true }) : b.m.at.localeCompare(a.m.at)))
  return (
    <div className={cn("grid gap-4", !clientId && "lg:grid-cols-[300px_minmax(0,1fr)]")}>
      {!clientId && (
        <nav aria-label="Channels" className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-card self-start">
          <button onClick={() => setCh(null)} aria-current={!ch ? "page" : undefined} className={cn("flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-[var(--surface-2)]", !ch && "bg-[var(--seq-100)]")}>All channels<span className="text-xs text-[var(--text-muted)]">{all.filter(({ m }) => isOpen(s, m)).length} open</span></button>
          {s.clients.filter((c) => c.kickoffDate && c.kickoffDate <= s.today).map((c) => {
            const mo = sentiment(c, s)
            return (
              <button key={c.id} onClick={() => setCh(c.id)} aria-current={ch === c.id ? "page" : undefined} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t px-4 py-3 text-left hover:bg-[var(--surface-2)]", ch === c.id && "bg-[var(--seq-100)]")}>
                <span className="flex min-w-0 flex-col"><span className="truncate text-sm font-medium">{c.name}</span><span className="text-xs text-[var(--text-muted)]">{mo.open} open · {mo.label.toLowerCase()}</span></span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: moodC(mo.score) }}>{mo.score > 0 ? "+" : ""}{mo.score}</span>
              </button>
            )
          })}
        </nav>
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <Segmented label="Show" value={view} onChange={setView} options={[{ id: "open", label: "Needs a reply" }, { id: "worried", label: "Worried" }, { id: "all", label: "All" }]} />
        <section className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
          {shown.length === 0 && <p className="p-6 text-sm text-[var(--text-muted)]">Nothing here.</p>}
          {shown.slice(0, 60).map(({ m, c }) => <MsgRow key={m.id} m={m} c={c} showClient={!clientId} />)}
          <div className="px-5 pb-3"><Shown n={60} of={shown.length} hint="Filter by client or topic to narrow it." /></div>
        </section>
      </div>
    </div>
  )
}

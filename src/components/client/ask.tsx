"use client"

// Ask AI: a chat over your own Shadow data, and the same data in your AI tools over MCP.
// Coming soon; this is a preview with sample answers. What it can see follows the role:
// members see only themselves, managers everyone but the owner, owners everyone.

import { Bot, Eye, Lock, Plug, Send, Sparkles } from "lucide-react"
import { Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WK_TO_MO } from "@/lib/client-data"
import { visibleWorkflows } from "@/lib/engine"
import { personStats } from "@/lib/people"
import { results } from "@/lib/results"
import { handoffs } from "@/lib/client-data"
import { useStore } from "@/lib/store"
import type { Client, Role, Seat } from "@/lib/types"

export function AskView({ c, role, me }: { c: Client; role: Role; me: Seat }) {
  const { s } = useStore()
  const scope = role === "Member" ? "Only you" : role === "Manager" ? "Everyone on the team except the owner" : "Everyone on the team, including you"
  const mine = personStats(c, me, s.today)
  const vis = visibleWorkflows(c, s.today)
  const top = [...vis].sort((a, b) => b.hoursWk - a.hoursWk)[0]
  const r = results(c, s.today)
  const wait = handoffs(c)[0]
  const key = c.seats.find((x) => x.id === c.fit.find((f) => f.keyPerson)?.seatId)
  const chat: [string, string][] = role === "Member"
    ? [["Where did my week go?", `About a third of your week was messages. Your biggest repeat task is "${mine.workflows[0]?.name ?? "status updates"}", and ${mine.live.length === 0 ? "no agent takes part of it yet" : `${mine.live.length} ${mine.live.length === 1 ? "agent already takes" : "agents already take"} part of your work`}.`], ["What can I hand to an agent next?", `"${mine.workflows[1]?.name ?? mine.workflows[0]?.name ?? "Standup notes"}" is next on your list. It's on the plan for the coming weeks.`]]
    : role === "Manager"
    ? [["Which workflow eats the most time on my team?", `"${top?.name}": about ${Math.round((top?.hoursWk ?? 0) * WK_TO_MO)} hours a month across ${top?.people} people, done ${top?.ways} different ways.`], ["Where does work wait longest?", `Handoffs from ${wait.from} to ${wait.to} wait about ${wait.waitHrs} hours on average, ${wait.count} times in the last two weeks.`]]
    : [["How much time have the agents given back?", `${r.time.hrsWk} hours a week from ${r.agents.length} live agents, worth $${Math.round(r.money.valueMo).toLocaleString()} a month at your payroll rates.`], ["Who should I hire next, if anyone?", `Nobody yet. With ${r.time.hrsWk} hours a week back, the team has room for about ${r.capacity} more clients first.${key ? ` ${key.id === me.id ? "Watch your own load: a lot of the work runs through you." : `Watch ${key.name.split(" ")[0]}: a lot of the work runs through them.`}` : ""}`]]
  return (
    <div data-tour="ask" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border bg-card p-5">
        <span aria-hidden className="grid size-10 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--seq-900)]"><Sparkles className="size-4" /></span>
        <div className="flex min-w-0 flex-1 flex-col"><span className="flex items-center gap-2 font-semibold">Ask about your data <Pill t="info">Coming soon</Pill></span><span className="text-sm text-[var(--text-secondary)]">Plain questions, answered from what Shadow has measured. This preview shows sample answers.</span></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section title="Preview" sub="Sample questions and answers">
          <div className="flex flex-col gap-3">
            {chat.map(([q, a]) => (
              <div key={q} className="flex flex-col gap-2">
                <span className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--graphite)] px-3.5 py-2 text-sm text-white">{q}</span>
                <span className="flex max-w-[90%] gap-2 self-start rounded-2xl rounded-bl-md bg-[var(--surface-2)] px-3.5 py-2.5 text-sm"><Bot className="mt-0.5 size-4 shrink-0 text-[var(--bronze)]" /><span>{a}</span></span>
              </div>
            ))}
            <div className="mt-2 flex gap-2"><Input disabled placeholder="Ask anything about your team's work" className="h-10 flex-1 rounded-xl" /><Button disabled className="h-10 rounded-xl"><Send />Ask</Button></div>
          </div>
        </Section>
        <div className="flex flex-col gap-5">
          <Section title="What it can see" sub="The same rules as the rest of the app">
            <div className="flex flex-col gap-2 text-sm">
              {([["Member", "Only you"], ["Manager", "Everyone except the owner"], ["Owner", "Everyone, including you"]] as const).map(([k, v]) => (
                <div key={k} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${k === role ? "border-[var(--bronze)] bg-[var(--seq-100)]" : ""}`}>
                  <span className="flex items-center gap-2 font-medium">{k === role ? <Eye className="size-4" /> : <Lock className="size-4 text-[var(--text-muted)]" />}{k}</span>
                  <span className="text-[var(--text-secondary)]">{v}</span>
                </div>
              ))}
              <p className="text-xs text-[var(--text-muted)]">You&apos;re signed in as {role.toLowerCase()}: {scope.toLowerCase()}.{role === "Member" ? " No dollar figures." : ""}</p>
            </div>
          </Section>
          <Section title="Use it in your own AI tools" sub="Coming soon">
            <div className="flex gap-3 text-sm">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)]"><Plug className="size-4" /></span>
              <span className="text-[var(--text-secondary)]">Connect Shadow to Claude, ChatGPT or Cursor and ask the same questions there, with the same access rules.</span>
            </div>
          </Section>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">Reference only, not the final design.</p>
    </div>
  )
}

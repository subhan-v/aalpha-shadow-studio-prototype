"use client"

// How it works: where the data comes from, what happens to it on the way to an opportunity,
// the privacy facts, and the 90 days. Privacy copy uses only the approved facts.

import { ArrowRight, Briefcase, CalendarDays, CheckCircle2, ChevronDown, EyeOff, Hand, KeyRound, Laptop, ListChecks, Lock, MessageSquare, ScanSearch, ShieldCheck, Sparkles, Target, UserRound } from "lucide-react"
import { Section } from "@/components/bits"
import { teamStats, WK_TO_MO } from "@/lib/client-data"
import { dayN, visibleWorkflows } from "@/lib/engine"
import { useStore } from "@/lib/store"
import { recordingNow } from "@/lib/recording"
import { past90 } from "@/lib/renewal"
import type { Client } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

export const PRIVACY: [typeof Lock, string, string][] = [
  [ShieldCheck, "Never used to judge you", "Your company agreed in writing: nothing here is used for reviews, pay, discipline or firing."],
  [EyeOff, "Your manager sees teams, not you", "Your own numbers are yours alone. Managers and owners see team totals."],
  [ListChecks, "You choose what it sees", "Only the work apps and sites on your allowlist."],
  [UserRound, "Work browser only, if you prefer", "Run just the Chrome extension on your work profile. No app on your laptop and no screenshots."],
  [ScanSearch, "Never what you type", "With the Mac app: screenshots at intervals, plus the app, site and clicks. Never your keystrokes, video, mic or camera."],
  [Lock, "Filtered on your laptop, deleted in 7 days", "Private info is redacted on your laptop before anything is sent. Screenshots are deleted after 7 days."],
  [Hand, "Work hours only", "It runs inside your work hours and stops when your screen locks. Pause any time from the menu bar."],
  [KeyRound, "7 days private from your company", "For your first 7 days nobody at your company sees anything from you. Delete anything you like and it never counts."],
]

const DAYS: { day: number; at: string; name: string; body: string; promise?: boolean }[] = [
  { day: 0, at: "Day 0", name: "Kickoff and install", body: `${APP} goes on every work laptop within 48 hours.` },
  { day: 7, at: "Weeks 1 to 3", name: "Measure", body: `${APP} learns how the team works. We review every finding before you see it, and start building with the team that has the most to gain.` },
  { day: 21, at: "Day 21", name: "Readout", body: "We walk you through what we found and pick the first agents with you." },
  { day: 30, at: "Day 30", name: "40 hours found", body: "40 hours a week of repeat work found, and your first agent live.", promise: true },
  { day: 31, at: "Days 31 to 85", name: "Hand it over", body: "Agents take the work back, one by one. An update lands every Friday." },
  { day: 90, at: "Day 90", name: "40 hours back", body: "40 hours a week back for your team, measured against day 0.", promise: true },
]

export function HowItWorks({ c, money }: { c: Client; money: boolean }) {
  const { s } = useStore()
  const t = s.today
  const st = teamStats(c, t)
  const rec = recordingNow(c, c.seats, t)
  // Opportunities leave out work someone said must never be automated, as everywhere else.
  const vis = visibleWorkflows(c, t).filter((w) => !w.neverAutomate)
  const n = dayN(c, t)
  const channels = c.connections.slackChannels.filter((x) => x.on).length

  const sources: { icon: typeof Laptop; name: string; what: string; gives: string; on: boolean; status: string }[] = [
    { icon: Laptop, name: "Desktop app", what: "Screenshots at intervals, plus the app, site and clicks, on your allowlist only.", gives: "How the work gets done, step by step, and how long each step takes.", on: rec.on > 0, status: `${rec.on} of ${rec.of} recording` },
    { icon: MessageSquare, name: "Slack", what: "Public channels, plus private channels your workspace admin is in. Never direct messages.", gives: "Asks, handoffs between teams, how fast people answer, and team mood.", on: c.slackConnected, status: c.slackConnected ? `${channels} channels` : "Not connected" },
    { icon: CalendarDays, name: "Calendar", what: "Meetings and who is in them.", gives: "Time in meetings, and the prep and follow-up around them.", on: c.connections.calendar, status: c.connections.calendar ? "Connected" : "Not connected" },
    { icon: Briefcase, name: "CRM", what: "Deals, clients and stages.", gives: "Ties the hours to clients and to revenue per person.", on: c.connections.hubspot, status: c.connections.hubspot ? "Connected" : "Not connected" },
  ]

  const pipeline: { icon: typeof Laptop; name: string; body: string; stat: string }[] = [
    { icon: Laptop, name: "Capture", body: "Screenshots at intervals, plus the app, site and clicks. It never records video.", stat: `${Math.round(st.observed * 215).toLocaleString()} activity events` },
    { icon: Lock, name: "Redact on the laptop", body: "Private info is encrypted and removed before anything leaves the laptop.", stat: "Before it is sent" },
    { icon: Sparkles, name: "AI finds workflows", body: "Looks only at high-level patterns: the same steps, done again and again.", stat: `${vis.length} workflows found` },
    { icon: Target, name: "Ranked opportunities", body: money ? "Ranked by hours, dollars and your goals. We review each one first." : "Ranked by hours and your goals. We review each one first.", stat: `${Math.round(vis.reduce((x, w) => x + w.hoursWk, 0) * WK_TO_MO).toLocaleString()} hours a month` },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="sources">
        <Section title="Where the data comes from" sub="What each source adds">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sources.map((x) => (
              <div key={x.name} className="flex flex-col gap-3 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold"><span aria-hidden className="grid size-8 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--seq-900)]"><x.icon className="size-4" /></span>{x.name}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", x.on ? "bg-[var(--good-bg)] text-[var(--delta-good)]" : "bg-[var(--surface-2)] text-[var(--text-secondary)]")}>{x.on && <CheckCircle2 className="size-3" />}{x.status}</span>
                </div>
                <p className="text-sm">{x.what}</p>
                <p className="mt-auto border-t pt-3 text-xs text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">Adds: </span>{x.gives}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div data-tour="pipeline">
        <Section title="From capture to opportunity" sub="What happens between a click and a finding">
          <ol className="flex flex-col items-stretch gap-2 md:flex-row">
            {pipeline.map((x, i) => (
              <li key={x.name} className="contents">
                <div className="flex flex-1 flex-col gap-2 rounded-2xl bg-[var(--surface-2)] p-4">
                  <span className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]"><span className="grid size-6 place-items-center rounded-full bg-[var(--graphite)] text-xs text-white">{i + 1}</span>Step {i + 1}</span>
                  <span className="flex items-center gap-2 font-semibold"><x.icon className="size-4 text-[var(--bronze)]" aria-hidden />{x.name}</span>
                  <span className="text-sm text-[var(--text-secondary)]">{x.body}</span>
                  <span className="mt-auto pt-1 text-sm font-semibold tabular-nums">{x.stat}</span>
                </div>
                {i < pipeline.length - 1 && <span aria-hidden className="grid place-items-center text-[var(--text-muted)]"><ArrowRight className="hidden size-4 md:block" /><ChevronDown className="size-4 md:hidden" /></span>}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div data-tour="privacy">
        <Section title="Privacy, in plain words" sub={`What ${APP} does and doesn't do`}>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {PRIVACY.map(([Icon, k, v]) => (
              <div key={k} className="flex gap-3">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)]"><Icon className="size-4 text-[var(--text-secondary)]" /></span>
                <span className="flex flex-col"><span className="text-sm font-medium">{k}</span><span className="text-sm text-[var(--text-secondary)]">{v}</span></span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div data-tour="next90">
        <Section title="Your 90 days" sub={n === null ? "Starts at kickoff" : past90(c, s.today) ? (c.renewal?.stage === "Renewed" ? "The 90 days are done. You're on the monthly plan." : "The 90 days are done.") : `You are on day ${n}`}>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DAYS.map((d, i) => {
              const nextDay = DAYS[i + 1]?.day ?? 999
              const now = n !== null && n >= d.day && n < nextDay
              const done = n !== null && n >= nextDay
              return (
                <li key={d.name} className={cn("flex flex-col gap-1.5 rounded-2xl border p-4", now && "border-[var(--bronze)] bg-[var(--seq-100)]")}>
                  <span className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--text-muted)]">
                    {d.at}
                    {now ? <span className="rounded-full bg-[var(--bronze)] px-2 py-0.5 text-white">You are here</span> : done ? <span className="inline-flex items-center gap-1 text-[var(--delta-good)]"><CheckCircle2 className="size-3.5" />Done</span> : null}
                  </span>
                  <span className="flex items-center gap-2 font-semibold">{d.name}{d.promise && <span className="rounded-full bg-[var(--good-bg)] px-2 py-0.5 text-xs font-medium text-[var(--delta-good)]">Guarantee</span>}</span>
                  <span className="text-sm text-[var(--text-secondary)]">{d.body}</span>
                </li>
              )
            })}
          </ol>
        </Section>
      </div>

      <p className="text-xs text-[var(--text-muted)]">{c.demo ? "Sample agency with made-up numbers. " : ""}Reference only, not the final design.</p>
    </div>
  )
}

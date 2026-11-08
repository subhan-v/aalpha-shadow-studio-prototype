"use client"

// Your data (members, v19.2): what Shadow records from this one person, where it comes from,
// what it never records, who sees what, and the controls they have. Built to answer the biggest
// worry first. Privacy lines use only the approved facts (PRIVACY and the common questions).

import { useState } from "react"
import { CalendarDays, CheckCircle2, ChevronDown, Circle, Laptop, MessageSquare, Mic, Pause, Settings, ShieldCheck } from "lucide-react"
import { Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { scheduleFor } from "@/lib/client-data"
import { fmtLong } from "@/lib/dates"
import { hasConsent } from "@/lib/consent"
import { installed } from "@/lib/engine"
import { FAQ } from "@/lib/faq"
import { recStatus } from "@/lib/recording"
import { useStore } from "@/lib/store"
import type { Client, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PRIVACY } from "./how"
import { APP } from "@/lib/flags"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function YourData({ c, me, go }: { c: Client; me: Seat; go: (tab: string) => void }) {
  const { s, update } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const t = s.today
  const st = recStatus(c, me, t)
  const win = scheduleFor(c, me.id)
  const hours = `${win.start} to ${win.end}, ${win.days.map((d) => DAYS[d - 1]).join(" ")}`
  const channels = c.connections.slackChannels.filter((x) => x.on).length
  const read = c.prefs[me.id]?.checklist?.includes("faq")
  const markRead = () => update(c.id, (x) => {
    const p = x.prefs[me.id] ?? { pausedUntil: null, start: null, end: null, block: [], allow: [] }
    return { ...x, prefs: { ...x.prefs, [me.id]: { ...p, checklist: [...(p.checklist ?? []), "faq"] } } }
  })

  const sources: { icon: typeof Laptop; name: string; on: boolean; status: string; records: string; never?: string }[] = [
    { icon: Laptop, name: `${APP} on your laptop`, on: installed(me, t), status: installed(me, t) ? `${st.status} · ${hours}` : "Not installed yet",
      records: "Screenshots at intervals, plus the app, site and clicks, only for the work apps and sites on your allowlist.",
      never: "Video, your mic or camera, and anything off your allowlist." },
    { icon: MessageSquare, name: "Slack", on: c.slackConnected, status: c.slackConnected ? (me.slack ? `Signed in as @${me.slack.handle} · ${channels} channels` : `${channels} channels`) : "Not connected",
      records: "What you post in public channels, and in private channels your workspace admin is in.",
      never: "Your direct messages or group DMs." },
    { icon: CalendarDays, name: "Calendar", on: c.connections.calendar, status: c.connections.calendar ? "Connected by your company" : "Not connected",
      records: "Meetings and who is in them." },
    // Only shown when the company connected a call recorder, so nobody is told meetings are private when they aren't.
    ...(c.connections.callNotes ? [{ icon: Mic, name: "Call notes", on: true, status: "Connected by your company", records: "Summaries of the calls your company records." }] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border bg-card p-5">
        <span aria-hidden className="grid size-10 place-items-center rounded-full bg-[var(--good-bg)] text-[var(--delta-good)]"><ShieldCheck className="size-5" /></span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{APP} studies the work, not the worker</span>
          <span className="text-sm text-[var(--text-secondary)]">It looks for repeat work an agent could take off your plate. Here is exactly what it records from you, {me.name.split(" ")[0]}, and what it never does.</span>
        </div>
      </div>

      <Section title="Where your data comes from" sub="Your sources, and what each one records">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {sources.map((x) => (
            <div key={x.name} className="flex flex-col gap-3 rounded-2xl border p-4">
              <span className="flex items-center gap-2 font-semibold"><span aria-hidden className="grid size-8 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--seq-900)]"><x.icon className="size-4" /></span>{x.name}</span>
              <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", x.on ? "bg-[var(--good-bg)] text-[var(--delta-good)]" : "bg-[var(--surface-2)] text-[var(--text-secondary)]")}>{x.on ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}{x.status}</span>
              <p className="text-sm"><span className="font-medium">Records: </span>{x.records}</p>
              {x.never && <p className="mt-auto border-t pt-3 text-sm text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">Never: </span>{x.never}</p>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Consent: {hasConsent(c, me) ? `you agreed to ${me.consentVersion ?? c.consentVersion ?? "the consent form"}${me.consentAt ? ` on ${fmtLong(me.consentAt)}` : ""}.` : `not given yet. ${APP} can't record you until you agree.`}</p>
      </Section>

      <Section title="Privacy, in plain words" sub="The same facts your company signed up to">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {PRIVACY.map(([Icon, k, v]) => (
            <div key={k} className="flex gap-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)]"><Icon className="size-4 text-[var(--text-secondary)]" /></span>
              <span className="flex flex-col"><span className="text-sm font-medium">{k}</span><span className="text-sm text-[var(--text-secondary)]">{v}</span></span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Who sees what" sub="Inside your company, and at Aalpha">
        <ul className="flex flex-col text-sm">
          <li className="flex gap-3 border-t py-2.5 first:border-t-0"><span className="w-32 shrink-0 font-medium">You</span><span className="text-[var(--text-secondary)]">My work: your time, your repeat work and what agents take off your plate.</span></li>
          <li className="flex gap-3 border-t py-2.5"><span className="w-32 shrink-0 font-medium">Your manager</span><span className="text-[var(--text-secondary)]">Your hours and repeat work, your team&apos;s totals, and the interview summary you approve. Never your pay rate, and never your My work page.</span></li>
          <li className="flex gap-3 border-t py-2.5"><span className="w-32 shrink-0 font-medium">Aalpha</span><span className="text-[var(--text-secondary)]">Reviews every finding before your company sees it. Subhan answers your questions.</span></li>
        </ul>
      </Section>

      <Section title="Your controls" sub="You can change these any time">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-[10px]" onClick={() => go("me")}><Pause />Pause recording</Button>
          <Button variant="outline" className="rounded-[10px]" onClick={() => go("settings")}><Settings />Change your allowlist</Button>
          <Button variant="outline" className="rounded-[10px]" onClick={() => go("settings")}>Delete a day</Button>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Deleting a day goes to Subhan for approval so the team&apos;s baseline stays intact. You see the answer in Settings.</p>
      </Section>

      <Section title="Common questions" sub="Answers Subhan approved" right={read ? <span className="text-sm text-[var(--delta-good)]">Marked as read</span> : <Button size="sm" className="rounded-[10px]" onClick={markRead}>I&apos;ve read these</Button>}>
        <div className="flex flex-col">
          {FAQ.map((f) => (
            <div key={f.id} className="border-t first:border-t-0">
              <button onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium">{f.q}<ChevronDown className={cn("size-4 shrink-0 transition", open === f.id && "rotate-180")} /></button>
              {open === f.id && <p className="pb-3 text-sm text-[var(--text-secondary)]">{f.a}</p>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

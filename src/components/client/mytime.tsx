"use client"

// My time: private to the person. Built from what Shadow already captures (foreground time per
// app, focus stretches, Slack posting times and @mentions) plus payroll for the dollar value.
// The pilot's CEO view uses Mina's real report numbers (Oct 14 to 19).

/* eslint-disable @next/next/no-img-element */
import { ArrowDownRight, ArrowUpRight, Bot, Clock, DollarSign, Lock, Pause, Play, Shuffle, Sunset, Target, Zap } from "lucide-react"
import { CatBubble, Kpi, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { scheduleFor, WK_TO_MO } from "@/lib/client-data"
import { toolIcon, TOOL_NAME } from "@/lib/delivery"
import { addDays, fmtLong, hash } from "@/lib/dates"
import { useStore } from "@/lib/store"
import { afterHoursPct, focusOf, handOffWk, personStats, shareOf } from "@/lib/people"
import type { Client, Seat, Tool } from "@/lib/types"
import { cn } from "@/lib/utils"

const TYPE_C = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"]

export function myData(c: Client, me: Seat) {
  const h = (k: string) => hash(me.id + k)
  const p = c.pilot && me.id === c.seats[0].id ? c.pilot.ceo : null
  const rate = c.pay[me.id] ?? 38
  const hours = p ? 16.5 : Math.round(30 + h("h") * 14)
  const typesRaw: [string, number][] = p
    ? [["Messages and email", 0.37], ["Meetings", 0.28], ["Clients and market", 0.14], ["Docs", 0.1], ["Admin", 0.07], ["Tools and AI", 0.04]]
    : [["Messages and email", 0.33], ["Client work", 0.27], ["Meetings", 0.16], ["Docs", 0.12], ["Admin", 0.07], ["Tools and AI", 0.05]]
  const apps: [Tool | "chrome", number][] = p
    ? [["slack", 0.31], ["gmail", 0.12], ["hubspot", 0.14], ["docs", 0.1], ["sheets", 0.07], ["chrome", 0.26]]
    : [["slack", 0.24 + h("a") * 0.08], ["gmail", 0.1], ["sheets", 0.14], ["docs", 0.1], ["asana", 0.08], ["chrome", 0.2]]
  return {
    p, rate, hours,
    lastWeek: p ? 14.2 : Math.round(hours * (0.9 + h("lw") * 0.25)),
    messagesPct: p ? p.messagesPct : Math.round(typesRaw[0][1] * 100 + h("m") * 8),
    longestFocus: focusOf(c, me).longestMin,
    medianStretch: p ? `${p.medianStretchSec}s` : `${Math.round(2 + h("ms") * 4)}m`,
    switchesPerHour: p ? 41 : Math.round(12 + h("sw") * 20),
    focusHours: focusOf(c, me).hours,
    afterHours: afterHoursPct(c, me),
    botMentions: p ? p.botMentionsPct : Math.round(20 + h("bm") * 40),
    asksMade: p ? p.asks6mo : Math.round(12 + h("ask") * 40),
    asksTo: p ? [["Viktor", p.asksToViktor], ["COO", p.asksToCoo], ["Sales lead", 9], ["CSM", 7], ["Others", p.asks6mo - p.asksToViktor - p.asksToCoo - 16]] as [string, number][] : ([["Team lead", 5 + Math.round(hash(me.id + "q1") * 8)], ["Ops", 2 + Math.round(hash(me.id + "q2") * 6)], ["Account lead", 1 + Math.round(hash(me.id + "q3") * 5)]] as [string, number][]).sort((a, b) => b[1] - a[1]),
    types: typesRaw.map(([n, s]) => ({ name: n, hours: Math.round(hours * s * 10) / 10, value: Math.round(hours * s * rate) })),
    apps: apps.map(([t, s]) => ({ t, name: t === "chrome" ? "Other sites" : TOOL_NAME[t], hours: Math.round(hours * s * 10) / 10 })),
    heat: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, di) => ({
      day: d,
      cells: Array.from({ length: 14 }, (_, i) => {
        const wk = di >= 5
        const hr = 7 + i
        const base = wk ? (p ? 14 : 3) : hr >= 9 && hr <= 17 && hr !== 12 ? 32 : hr >= 19 ? (p ? 22 : 6) : 12
        return Math.max(0, Math.round(base + (h(d + i) - 0.5) * 26))
      }),
    })),
    stretches: (p ? [["Under 1m", 612], ["1-5m", 140], ["5-15m", 31], ["15-25m", 2], ["25m+", 0]] : [["Under 1m", Math.round(300 + h("s1") * 200)], ["1-5m", Math.round(80 + h("s2") * 40)], ["5-15m", Math.round(30 + h("s3") * 20)], ["15-25m", Math.round(6 + h("s4") * 10)], ["25m+", Math.round(2 + h("s5") * 6)]]) as [string, number][],
  }
}

// Dollars only for owners. Managers and members see hours, never a pay rate.
export function MyTimeTab({ c, me, money, compact = false, found }: { c: Client; me: Seat; money: boolean; compact?: boolean; found?: React.ReactNode }) {
  const { s, update } = useStore()
  const d = myData(c, me)
  const prefs = c.prefs[me.id]
  const paused = !!prefs?.pausedUntil && prefs.pausedUntil > s.today
  const win = scheduleFor(c, me.id)
  const schedule = `${prefs?.start ?? win.start} to ${prefs?.end ?? win.end}, ${win.days.map((n) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][n - 1]).join(" ")}`
  const delta = Math.round((d.hours - d.lastWeek) * 10) / 10
  // The person's own repeat work, minus anything someone said must never be automated.
  const handoff = personStats(c, me, s.today).workflows.filter((w) => !w.neverAutomate).slice(0, 4)
  const shade = (v: number) => (v === 0 ? "var(--surface-2)" : v < 10 ? "#e8f1fc" : v < 22 ? "#b7d3f6" : v < 34 ? "#6da7ec" : v < 46 ? "#2a78d6" : "#184f95")
  // Keep everything else in the person's settings (their setup checklist included); only the pause changes.
  const setPause = (until: string | null) => update(c.id, (x) => ({ ...x, prefs: { ...x.prefs, [me.id]: { ...(x.prefs[me.id] ?? { start: null, end: null, block: [], allow: [] }), pausedUntil: until } } }))
  const best = d.heat.slice(0, 5).flatMap((r) => r.cells.slice(1, 6).map((v, i) => ({ d: r.day, h: 8 + i, v }))).sort((a, b) => b.v - a.v)[0]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border bg-card px-5 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--seq-800)]"><Lock className="size-4" /></span>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-medium">Only {me.name} sees this page</span>
          <span className="text-xs text-[var(--text-muted)]">{paused ? `Recording paused until ${fmtLong(prefs!.pausedUntil!)}` : `Recording ${schedule}`}{d.p ? " · real pilot numbers, Oct 14 to 19" : ""}</span>
        </div>
        <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium", paused ? "bg-[var(--watch-bg)] text-[var(--watch-fg)]" : "bg-[var(--good-bg)] text-[var(--delta-good)]")}><span className={cn("size-1.5 rounded-full", paused ? "bg-[var(--status-warning)]" : "bg-[var(--status-good)]")} />{paused ? "Paused" : "Recording"}</span>
        {paused
          ? <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setPause(null)}><Play />Resume</Button>
          : <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setPause(addDays(s.today, 1))}><Pause />Pause for today</Button>}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<Clock />} hue="#2a78d6" label="Hours this week" value={d.hours} note={<span className={cn("inline-flex items-center gap-0.5", delta > 0 ? "text-[var(--delta-bad)]" : "text-[var(--delta-good)]")}>{delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(delta)} h vs last week</span>} />
        {money
          ? <Kpi icon={<DollarSign />} hue="#1baf7a" label="Value of your week" value={`$${Math.round(d.hours * d.rate).toLocaleString()}`} note={`At $${d.rate.toLocaleString()} an hour (payroll)`} />
          : <Kpi icon={<Bot />} hue="#1baf7a" label="Could hand off" value={`${handOffWk(c, me, s.today)} h`} note="Your share of repeat work in your role, a week" />}
        <Kpi icon={<Target />} hue="#6250d6" label="Deep focus" value={`${d.focusHours} h`} note={`Blocks of 25 min or more · longest ${d.longestFocus} min`} t={d.focusHours < 3 ? "warn" : undefined} />
        <Kpi icon={<Shuffle />} hue="#eb6834" label="Switches an hour" value={d.switchesPerHour} note={`Median stretch ${d.medianStretch}`} t={d.switchesPerHour > 30 ? "bad" : undefined} />
        <Kpi icon={<Sunset />} hue="#e87ba4" label="After hours" value={`${d.afterHours}%`} note="Of active time outside your set hours" t={d.afterHours > 30 ? "warn" : undefined} />
      </div>
      {found}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section title="When you work" sub="Active minutes per hour, average week" right={best && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--seq-100)] px-2.5 py-1 text-xs font-medium text-[var(--seq-900)]"><Zap className="size-3.5" />Best focus window: {best.d} {best.h}:00</span>}>
          <div className="overflow-x-auto">
            <div className="flex min-w-[560px] flex-col gap-1">
              <div className="grid grid-cols-[36px_repeat(14,minmax(0,1fr))] gap-1 text-xs text-[var(--text-muted)]"><span />{Array.from({ length: 14 }, (_, i) => <span key={i} className="text-center">{((7 + i - 1) % 12) + 1}{7 + i < 12 ? "a" : "p"}</span>)}</div>
              {d.heat.map((r) => (
                <div key={r.day} className="grid grid-cols-[36px_repeat(14,minmax(0,1fr))] gap-1">
                  <span className="self-center text-xs text-[var(--text-muted)]">{r.day}</span>
                  {r.cells.map((v, i) => <span key={i} title={`${r.day} ${7 + i}:00 · ${v} min`} className="h-6 rounded-md" style={{ background: shade(v) }} />)}
                </div>
              ))}
            </div>
          </div>
        </Section>
        <Section title="Time by app" sub="Hours this week">
          <div className="flex flex-col gap-2.5">
            {d.apps.map((a) => (
              <div key={a.name} className="grid grid-cols-[22px_110px_minmax(0,1fr)_44px] items-center gap-2.5 text-sm">
                {a.t === "chrome" ? <span className="grid size-5 place-items-center rounded-full bg-[var(--surface-2)] text-xs">⋯</span> : <img src={toolIcon(a.t)} alt="" className="size-5" />}
                <span className="truncate">{a.name}</span>
                <span className="h-2 rounded-full bg-[var(--surface-2)]"><span className="block h-2 rounded-full bg-[var(--bronze)]" style={{ width: `${(a.hours / Math.max(...d.apps.map((x) => x.hours))) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{a.hours}h</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Your time by type of work" sub={money ? "Hours and what they cost this week" : "Hours this week"}>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">{d.types.map((x, i) => <span key={x.name} title={`${x.name}: ${x.hours} h`} style={{ width: `${(x.hours / d.hours) * 100}%`, background: TYPE_C[i] }} />)}</div>
          <div className="mt-4 flex flex-col">
            {d.types.map((x, i) => (
              <div key={x.name} className="grid grid-cols-[minmax(0,1fr)_56px_auto] items-center gap-3 border-t py-2 text-sm first:border-t-0">
                <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: TYPE_C[i] }} />{x.name}</span>
                <span className="text-right tabular-nums text-[var(--text-secondary)]">{x.hours}h</span>
                {money && <span className="w-20 text-right font-semibold tabular-nums">${x.value.toLocaleString()}</span>}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Who pulls you in" sub="@mentions to you, and the asks you make">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-[var(--text-secondary)]"><span>From people {100 - d.botMentions}%</span><span>From bots and alerts {d.botMentions}%</span></div>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full"><span className="bg-[var(--bronze)]" style={{ width: `${100 - d.botMentions}%` }} /><span className="bg-[#c3c8d2]" style={{ width: `${d.botMentions}%` }} /></div>
            {d.botMentions > 50 && <span className="w-fit rounded-full bg-[var(--watch-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--watch-fg)]">Most of your pings are automated. Mute or route them.</span>}
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <span className="text-sm font-medium">{d.asksMade} asks you made{d.p ? " in 6 months" : " this month"}</span>
            {d.asksTo.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[100px_minmax(0,1fr)_32px] items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-xs">{k === "Viktor" && <Bot className="size-3.5 text-[var(--bronze)]" />}{k}</span>
                <span className="h-2 rounded-full bg-[var(--surface-2)]"><span className="block h-2 rounded-full" style={{ width: `${(v / d.asksTo[0][1]) * 100}%`, background: k === "Viktor" ? "var(--bronze)" : "#86b6ef" }} /></span>
                <span className="text-right tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Members see their repeat work, with a check on each, in My work instead. */}
      <div className={cn("grid gap-5", !compact && "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]")}>
        {!compact && <Section title="Hand these off" sub={money ? "Work you repeat that the team or an agent could take · valued at your rate" : "Work you repeat that the team or an agent could take"}>
          <div className="flex flex-col">
            {handoff.map((w) => {
              const mine = shareOf(c, w)
              return (
                <div key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t py-3 first:border-t-0">
                  <span className="flex min-w-0 flex-col gap-1"><span className="truncate text-sm font-medium">{w.name}</span><span className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><CatBubble c={w.category} />{Math.round(mine * WK_TO_MO * 10) / 10} h of yours a month</span></span>
                  <span className="text-right"><span className="block font-semibold tabular-nums text-[var(--delta-good)]">{money ? `$${Math.round(mine * WK_TO_MO * d.rate).toLocaleString()}` : `${Math.round(mine * 10) / 10} h`}</span><span className="text-xs text-[var(--text-muted)]">{money ? "a month" : "a week"}</span></span>
                </div>
              )
            })}
            {handoff.length === 0 && <p className="py-2 text-sm text-[var(--text-muted)]">Appears once findings are published.</p>}
          </div>
        </Section>}
        <Section title="Focus stretches" sub="How long you stay on one thing">
          <div className="flex h-32 items-end gap-2 border-b">{d.stretches.map(([k, v]) => <div key={k} title={`${v} stretches of ${k}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className="text-xs tabular-nums text-[var(--text-secondary)]">{v}</span><div className="w-full max-w-8 rounded-t-[4px]" style={{ height: `${Math.max(2, (v / d.stretches[0][1]) * 80)}%`, background: k === "25m+" ? "var(--status-good)" : "var(--bronze)" }} /></div>)}</div>
          <div className="flex gap-2 pt-1.5">{d.stretches.map(([k]) => <span key={k} className="flex-1 text-center text-xs text-[var(--text-muted)]">{k}</span>)}</div>
        </Section>
      </div>
    </div>
  )
}

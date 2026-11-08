"use client"

// Presenter mode: a guided walk through the client app for a sales call, written so someone who
// has never seen Shadow can follow it alone. Each stop opens a page, lights up one area, and says
// what it is, why an owner cares, and what to click. Numbers come from the client's own data, so
// the script never drifts from the screen. Arrow keys move, Escape exits, and it resumes where
// the presenter left off.

/** The last stop shown for a client, so Present picks up where it stopped. Browser storage only. */
export const savedStop = (clientId: string) => { try { return Number(localStorage.getItem(`shadow-tour-${clientId}`)) || 0 } catch { return 0 } }
const saveStop = (clientId: string, i: number | null) => { try { if (i === null) localStorage.removeItem(`shadow-tour-${clientId}`); else localStorage.setItem(`shadow-tour-${clientId}`, String(i)) } catch { /* private window */ } }

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, MousePointerClick, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { teamStats } from "@/lib/client-data"
import { visibleWorkflows } from "@/lib/engine"
import { clientGoals, goalFocus, teamGoals } from "@/lib/goals"
import { orgOf } from "@/lib/teams"
import { results } from "@/lib/results"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

/** One stop: the page to open, the area to light up, a plain headline, what it is, why an owner
 *  cares, and what to click. `sub` opens a Settings section. An empty target lights up nothing. */
export type Stop = { tab: string; sub?: string; target: string; title: string; what: string; why: string; click?: string }

const usd = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n).toLocaleString()}`)

export function tourStops(c: Client, today: string): Stop[] {
  const st = teamStats(c, today)
  const r = results(c, today)
  // The same opportunity set as the Overview: never-automate work is left out.
  const vis = visibleWorkflows(c, today).filter((w) => !w.neverAutomate)
  const focus = goalFocus(c)
  const served = vis.filter((w) => focus.has(w.category)).length
  const hrsMo = Math.round(st.total)
  const key = c.fit.find((f) => f.keyPerson)
  const keySeat = key && c.seats.find((x) => x.id === key.seatId)
  const sops = c.sops.filter((x) => x.status === "published").length
  const fastest = [...vis].sort((a, b) => b.hoursWk - a.hoursWk).find((w) => w.ways > 1)
  const goals = clientGoals(c).length
  const team = teamGoals(c).length
  const interviewed = c.seats.filter((x) => x.interview?.status === "approved").length
  const pods = orgOf(c) !== "function"
  return [
    { tab: "how", target: "next90", title: `${APP}, in one minute`,
      what: `${APP} watches how your team works, finds the work they repeat, and our team builds AI agents to take it over.`,
      why: "The promise: 40 hours a week of repeat work found by day 30, and 40 hours a week handed back by day 90. Both are guaranteed.",
      click: "Press Next, or use the arrow keys." },
    { tab: "how", target: "sources", title: "Where the data comes from",
      what: "Four sources: a small desktop app, your Slack (public channels and the private ones the founder is in), your calendar and your CRM.",
      why: "Together they show how work really gets done, not how people remember doing it." },
    { tab: "how", target: "privacy", title: `What ${APP} never sees`,
      what: "You choose the apps and sites. No video, no mic, no camera, no Slack direct messages, and private info is redacted on the laptop before anything is sent.",
      why: "Anyone can pause it at any time, and the analysis only looks at high-level patterns." },
    { tab: "getstarted", target: "getstarted", title: "Everyone starts with a short checklist",
      what: "Sign in with Slack, read and agree to the consent form, install the app, then a 5-minute interview. Each role gets its own list.",
      why: "The rest of the app opens once the checklist is done, so nobody is half set up.",
      click: "Each step has its own button. Agreeing is the only way past consent." },
    { tab: "interview", target: "interview", title: "A 5-minute voice interview",
      what: `Five questions, picked for the person's role. As they talk, ${APP} turns answers into cards: goals, steps in their work, things to hand off.`,
      why: `Each person confirms every card before anything is used${interviewed ? `. ${interviewed} of ${c.seats.length} people have done theirs` : ""}. The audio is deleted after processing.`,
      click: "Press Redo it to walk through the questions yourself." },
    { tab: "team", target: "kpis", title: `${hrsMo.toLocaleString()} hours a month of repeat work`,
      what: `Found across ${c.seats.length} people, worth about ${usd(st.dollars)} a month${c.connections.payroll !== "none" ? " at your own payroll rates" : " at an estimated rate"}.`,
      why: `That's about ${Math.round(hrsMo / 160)} full-time people's worth of work you could hand off.`,
      click: "Click any number to see the rows behind it." },
    { tab: "team", target: "opps", title: "The biggest win is at the top",
      what: "Every opportunity, ranked by what it's worth and by your goals.",
      why: "You never have to work out where to start.",
      click: "Click one to see how that work is done today." },
    { tab: "roster", target: "roster", title: "Who's recording, and who isn't",
      what: "Everyone on the team with their status: recording, paused, not installed, missing a permission or consent.",
      why: `${APP} only finds what it can see. One click nudges a person, or everyone stuck at the same step, in your name.`,
      click: "Scroll down to the list: anyone who isn't recording has a Nudge button." },
    { tab: "goals", target: "goal-lock", title: "Your goals steer everything",
      what: `You set ${goals || "your"} company goals with us and lock them in. Changing one later is a request we approve.`,
      why: `${served} of ${vis.length} workflows serve a goal, so they rank first everywhere in the app.` },
    { tab: "goals", target: "team-goals", title: "Goals at three levels",
      what: `Company goals, then team goals set by each manager${team ? ` (${team} so far)` : ""}, then each person's own goals about getting time back.`,
      why: "Each person's work connects to what the company is aiming for. Personal goals stay private; everyone else only sees whether they're on track." },
    { tab: "workflows", target: "workflows", title: `${vis.length} workflows, measured`,
      what: "Each repeat task: who does it, how often, and how long it takes.",
      why: fastest ? `"${fastest.name}" is done ${fastest.ways} different ways. The fastest is ${Math.round((fastest.maxMin / fastest.minMin) * 10) / 10}x quicker than the slowest, and becomes the standard.` : "The fastest way of doing each one becomes the standard.",
      click: "The Processes toggle at the top shows where work waits between steps." },
    { tab: "people", target: "people", title: "Every person, one row",
      what: `What ${APP} found in each person's work, and the hours the agents give back to them.`,
      why: "It's time handed back, not a productivity score. Managers see their own team, without pay rates." },
    { tab: "exec", target: "exec", title: "The Executive report",
      what: "Your own week next to the company's: where leadership time goes, what could be delegated, and the risks waiting on you.",
      why: "One page instead of asking five people for updates." },
    { tab: "automations", target: "results", title: `${r.time.hrsWk} hours a week back already`,
      what: `${r.agents.length} agents are live, worth about ${usd(r.money.valueMo)} a month, measured against the baseline we locked at kickoff.`,
      why: `That's room for about ${r.capacity} more clients with the same team.` },
    { tab: "automations", target: "agents", title: "Every agent, checked",
      what: "Runs, success rate, how often a person had to step in, and minutes a run before and after.",
      why: "If an agent gets something wrong, you tell us in one click and it lands with our team.",
      click: "Look for \"Not working right?\" on any row." },
    { tab: "playbook", target: "playbook", title: "Your Ops Playbook",
      what: `${sops} step-by-step guides written from how your team actually works, by department.`,
      why: "New hires learn the fastest way from day one. Owners and managers can edit them." },
    { tab: "fitmap", target: "fitmap", title: "The Team Fit Map",
      what: "Your org chart, built from the Culture Intelligence survey, with each person's fit to their role.",
      why: keySeat ? `${keySeat.name} is a key person: a lot of work runs through them, so losing them is a risk.` : "It shows who the business leans on most.",
      click: "Click anyone for their full profile." },
    { tab: "reports", target: "reports", title: "A report every Friday",
      what: "A Weekly Progress Update every Friday and a scorecard every month, in Slack and here.",
      why: "You always know what changed without asking.",
      click: "Ask for a custom report in plain words; we reply here." },
    { tab: "settings", sub: "connections", target: "connectors", title: "Connect your tools",
      what: `Calendar, CRM, project tools and more. Each one can cover the whole company or only certain ${pods ? "pods" : "teams"}.`,
      why: "More sources mean more of the work is seen, and more of it can be handed to agents." },
    { tab: "how", target: "", title: "What happens next",
      what: "Kickoff call, then everyone installs within 48 hours. By day 30 you'll see 40 hours a week of repeat work and your first agent live.",
      why: "By day 90, 40 hours a week are back with your team. After that, the monthly plan adds new agents every month.",
      click: "After the tour, the help button in the bottom corner reaches our team any time." },
  ]
}

type Rect = { top: number; left: number; width: number; height: number }

export function Tour({ c, step, go, exit }: { c: Client; step: number; go: (i: number) => void; exit: () => void }) {
  const { s } = useStore()
  const stops = tourStops(c, s.today)
  const i = Math.min(Math.max(0, step), stops.length - 1)
  const stop = stops[i]
  const [rect, setRect] = useState<Rect | null>(null)
  useEffect(() => saveStop(c.id, i), [c.id, i])
  const finish = () => { saveStop(c.id, null); exit() }

  // Find the area once the tab has rendered, jump it under the top bar, then follow it.
  useEffect(() => {
    let el: HTMLElement | null = null
    let frame = 0
    let tries = 0
    const timers: number[] = []
    // Below the sticky top bar when it is pinned (wider screens); the top edge otherwise.
    const inset = () => Math.max(8, (document.querySelector("[data-topbar]")?.getBoundingClientRect().bottom ?? 0) + 4)
    const measure = () => {
      if (!el) return
      const b = el.getBoundingClientRect()
      const top = Math.max(inset(), b.top - 8)
      const bottom = Math.min(window.innerHeight - 8, b.bottom + 8)
      setRect(bottom > top ? { top, left: Math.max(4, b.left - 8), width: Math.min(window.innerWidth - 8, b.width + 16), height: bottom - top } : null)
    }
    const find = () => {
      // A stop with no target is a talking point: no highlight, page scrolled to the top.
      if (!stop.target) { setRect(null); window.scrollTo({ top: 0 }); return }
      el = document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`)
      if (!el && tries++ < 60) { frame = requestAnimationFrame(find); return }
      if (!el) { setRect(null); return }
      const pinned = window.matchMedia("(min-width: 768px)").matches
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - (pinned ? 72 : 16)) })
      measure()
      // Layout can still settle (fonts, charts), so check again shortly after.
      timers.push(window.setTimeout(measure, 120), window.setTimeout(measure, 450))
    }
    frame = requestAnimationFrame(find)
    document.addEventListener("scroll", measure, { passive: true, capture: true })
    window.addEventListener("resize", measure)
    return () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout); document.removeEventListener("scroll", measure, { capture: true }); window.removeEventListener("resize", measure) }
  }, [stop.target, stop.tab])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowRight" && i < stops.length - 1) go(i + 1)
      else if (e.key === "ArrowLeft" && i > 0) go(i - 1)
      else if (e.key === "Escape") exit()
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [i, stops.length, go, exit])

  return (
    <>
      {rect && (
        <div aria-hidden className="pointer-events-none fixed z-40 rounded-[24px] transition-all duration-300"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: "0 0 0 9999px rgb(14 18 27 / 0.48), 0 0 0 3px var(--bronze)" }} />
      )}
      <div role="dialog" aria-label="Guided demo" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[46vh] max-w-[520px] flex-col gap-2 overflow-y-auto rounded-[var(--radius-card)] border bg-card p-4 shadow-2xl md:max-h-none md:gap-3 md:p-5 lg:left-auto lg:right-6 lg:w-[480px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium tabular-nums text-[var(--text-muted)]">Stop {i + 1} of {stops.length}</span>
          <span className="flex items-center gap-1">
            {i > 0 && <Button size="xs" variant="ghost" onClick={() => go(0)}>Start over</Button>}
            <Button size="icon-sm" variant="ghost" aria-label="Exit the demo" onClick={exit}><X /></Button>
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden><div className="h-full rounded-full bg-[var(--bronze)] transition-all" style={{ width: `${((i + 1) / stops.length) * 100}%` }} /></div>
        <div className="flex flex-col gap-2" aria-live="polite">
          <span className="text-lg font-semibold leading-tight tracking-[-0.02em] md:text-2xl">{stop.title}</span>
          <p className="text-sm leading-relaxed md:text-base">{stop.what}</p>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">{stop.why}</p>
          {stop.click && <p className="flex items-start gap-2 rounded-xl bg-[var(--seq-100)] px-3 py-2 text-sm text-[var(--seq-900)]"><MousePointerClick className="mt-0.5 size-4 shrink-0" />{stop.click}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden min-w-0 flex-1 flex-wrap gap-1 md:flex">
            {stops.map((x, k) => <button key={k} aria-label={`Go to stop ${k + 1}: ${x.title}`} aria-current={k === i ? "step" : undefined} onClick={() => go(k)} className={cn("h-2 rounded-full transition-all", k === i ? "w-5 bg-[var(--bronze)]" : k < i ? "w-2 bg-[var(--seq-500)]" : "w-2 bg-[var(--surface-2)] ring-1 ring-[var(--border)]")} />)}
          </div>
          <Button variant="outline" className="ml-auto h-10 rounded-[10px] md:ml-0" disabled={i === 0} onClick={() => go(i - 1)}><ArrowLeft />Back</Button>
          {i < stops.length - 1
            ? <Button className="h-10 rounded-[10px]" onClick={() => go(i + 1)}>Next<ArrowRight /></Button>
            : <Button className="h-10 rounded-[10px]" onClick={finish}>Finish</Button>}
        </div>
        {c.demo && <span className="hidden text-xs text-[var(--text-muted)] md:block">Sample agency, made-up numbers. Reference only, not the final design.</span>}
      </div>
    </>
  )
}

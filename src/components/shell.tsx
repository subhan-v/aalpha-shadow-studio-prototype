"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Bell, HeartPulse, Landmark, Mic, BookOpen, MessageSquare, Rocket, CalendarCheck, ChevronLeft, ChevronRight, Bug, Copy, DollarSign, FlaskConical, Gauge, History, Inbox, Layers, LayoutGrid, Lightbulb, MonitorSmartphone, RotateCcw, Settings, Sparkles, TrendingDown } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { addDays, fmtLong, weekStart } from "@/lib/dates"
import { newClient } from "@/lib/seed"
import { alerts, openActions } from "@/lib/engine"
import { decisions, outbox } from "@/lib/onboarding"
import { needsYou, slackMessages } from "@/lib/slack"
import { isOpen as requestOpen } from "@/lib/requests"
import { isOpenBug } from "@/lib/bugs"
import { accessOf, canMoney, MONEY_PAGES } from "@/lib/access"
import { useStore } from "@/lib/store"
import { openHealth } from "@/lib/agent-health"
import { retention } from "@/lib/health"
import { LAB } from "@/lib/insights"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { s, ready, shiftDays, setSim, reset, addClient, signInAs } = useStore()
  const access = accessOf(s)
  const open = alerts(s).length
  const sun = addDays(weekStart(s.today), 6)
  const weekCount = s.clients.flatMap((c) => openActions(s, c)).filter((a) => a.due <= sun).length
  // The client app has its own shell; Studio chrome never shows there.
  if (path.startsWith("/client/") || path.startsWith("/join/")) return <>{ready ? children : null}</>
  const retRisk = retention(s).rows.filter((r) => r.h.level === "At risk" && !!r.b.sub).length
  const due = decisions(s, s.clients.flatMap((c) => outbox(s, c))).length
  const slackDue = s.clients.flatMap((c) => slackMessages(c, s.today)).filter((m) => needsYou(s, m)).length
  const reqOpen = s.requests.filter(requestOpen).length
  const bugsOpen = (s.bugs ?? []).filter(isOpenBug)
  // v19: five areas. Inbox is everything waiting on Aalpha; Intelligence is the catalogue, the
  // Insight Lab and the evals; Platform is health and the system itself; Business is Admin only.
  const groups: { title: string; items: { href: string; label: string; icon: typeof Inbox; badge?: number; hot?: boolean; exact?: boolean }[] }[] = [
    { title: "Clients", items: [
      { href: "/", label: "Clients", icon: LayoutGrid, badge: s.clients.length },
    ] },
    { title: "Inbox", items: [
      { href: "/inbox", label: "Inbox and outbox", icon: Inbox, badge: open + reqOpen + slackDue + due + weekCount + bugsOpen.length, hot: open > 0 },
      { href: "/week", label: "This week", icon: CalendarCheck, badge: weekCount },
      { href: "/onboarding", label: "Onboarding", icon: Rocket, badge: due },
      { href: "/interviews", label: "Interviews", icon: Mic },
      { href: "/alerts", label: "Alerts", icon: Bell, badge: open, hot: open > 0 },
      { href: "/requests", label: "Requests", icon: Inbox, badge: reqOpen },
      { href: "/slack", label: "Slack", icon: MessageSquare, badge: slackDue },
    ] },
    { title: "Intelligence", items: [
      { href: "/intelligence", label: "Catalogue", icon: Lightbulb, exact: true },
      { href: "/intelligence/lab", label: "Insight Lab", icon: FlaskConical, badge: LAB.filter((x) => x.stage === "Draft" || x.stage === "Back-test").length },
      { href: "/intelligence/learning", label: "Learning", icon: Gauge },
    ] },
    { title: "Platform", items: [
      { href: "/health", label: "Health", icon: HeartPulse, badge: s.sim.pipelineFailing ? 1 : undefined, hot: s.sim.pipelineFailing },
      { href: "/agents", label: "Agent health", icon: Activity, badge: openHealth(s), hot: openHealth(s) > 0 },
      { href: "/bugs", label: "Bugs", icon: Bug, badge: bugsOpen.length, hot: bugsOpen.some((b) => b.severity === "P0" || b.severity === "P1") },
      { href: "/platform", label: "Users and AI", icon: Layers },
      { href: "/monitoring", label: "Activity", icon: MonitorSmartphone },
      { href: "/audit", label: "Audit trail", icon: History },
    ] },
    ...(!canMoney(s) ? [] : [{ title: "Business", items: [
      { href: "/revenue", label: "Revenue", icon: Landmark },
      { href: "/costs", label: "Costs", icon: DollarSign },
      { href: "/retention", label: "Retention", icon: TrendingDown, badge: retRisk, hot: retRisk > 0 },
    ] }]),
    { title: "Settings", items: [
      { href: "/assistant", label: "Ask Studio", icon: Sparkles },
      { href: "/library", label: "Library", icon: BookOpen },
      { href: "/templates", label: "Templates", icon: Copy },
      { href: "/settings", label: "Settings", icon: Settings },
    ] },
  ]

  return (
    <div className="flex min-h-screen flex-wrap">
      <nav aria-label="Studio" className="flex max-w-full flex-[1_1_220px] flex-col gap-6 bg-[var(--night)] px-4 py-5 text-[#e7e3da]">
        <div className="flex items-center gap-2.5 px-2">
          <span aria-hidden className="grid size-7 place-items-center rounded-[9px] bg-[var(--bronze-dark)]/15 ring-1 ring-[var(--bronze-dark)]/40">
            <span className="size-2.5 rounded-full bg-[var(--bronze-dark)]" />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">{APP} Studio</div>
            <div className="text-xs text-[#929088]">Aalpha only</div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#7d7a73]">{g.title}</span>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-0.5">
                {g.items.map((n) => {
                  const on = n.href === "/" ? path === "/" || path.startsWith("/clients") : n.exact ? path === n.href : path.startsWith(n.href)
                  return (
                    <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
                      className={cn("flex h-9 items-center gap-3 rounded-xl px-3 text-sm transition-colors", on ? "bg-[var(--night-raised)] font-medium text-white" : "text-[#aaa69f] hover:bg-[var(--night-raised)] hover:text-[#e7e3da]")}>
                      <n.icon className={cn("size-4", on && "text-[var(--bronze-dark)]")} aria-hidden />
                      {n.label}
                      {!!n.badge && <span className={cn("ml-auto min-w-6 rounded-full px-1.5 text-center text-xs font-medium tabular-nums", n.hot ? "bg-[#d2603f] text-white" : "bg-white/8 text-[#aaa69f]")}>{n.badge}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2 rounded-xl border border-white/8 p-3 text-xs leading-relaxed text-[#929088]">
          <label className="flex flex-col gap-1">
            <span>Signed in as</span>
            <select value={s.me} onChange={(e) => signInAs(e.target.value)} aria-label="Signed in as" className="h-8 rounded-lg border border-white/10 bg-[var(--night-raised)] px-2 text-[13px] text-[#e7e3da]">
              {s.team.map((m) => <option key={m.id} value={m.name}>{m.name} · {m.access ?? "Viewer"}</option>)}
            </select>
          </label>
          <span>{access === "Admin" ? "Admin: full access." : access === "Specialist" ? "Specialist: no revenue, margins or billing." : "Viewer: look only."}</span>
          <span>Prototype. Switching people is for the demo; sign-in comes with Slack.</span>
        </div>
      </nav>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-[var(--page)]/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
            <button className="grid size-7 place-items-center rounded-[9px] hover:bg-[var(--surface-2)]" aria-label="Back one day" onClick={() => shiftDays(-1)}><ChevronLeft className="size-4" /></button>
            <span className="min-w-32 px-1 text-center text-sm font-medium tabular-nums">{ready ? fmtLong(s.today) : ""}</span>
            <button className="grid size-7 place-items-center rounded-[9px] hover:bg-[var(--surface-2)]" aria-label="Forward one day" onClick={() => shiftDays(1)}><ChevronRight className="size-4" /></button>
            <button className="h-7 rounded-[9px] px-2.5 text-xs font-medium hover:bg-[var(--surface-2)]" onClick={() => shiftDays(7)}>+1 week</button>
          </div>
          <span className="text-xs text-[var(--text-muted)]">Simulated date</span>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Switch checked={s.sim.pipelineFailing} onCheckedChange={(v) => setSim({ pipelineFailing: !!v })} />
            Vision errors
          </label>
          <button className="h-8 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-[var(--surface-2)]" title="Test only: what happens when a deal is marked won in the CRM"
            onClick={() => { const names = ["Arc Social", "Lumen Labs", "Northpeak Media", "Copperline", "Vela Growth"]; const free = names.filter((x) => !s.clients.some((c) => c.name.startsWith(x))); const base = free.length ? free[Math.floor(Math.random() * free.length)] : names[0]; const n = free.length ? base : `${base} ${s.clients.filter((c) => c.name.startsWith(base)).length + 1}`; addClient(newClient({ name: n, seatCount: 18 + Math.floor(Math.random() * 20), plan: Math.random() > 0.5 ? "upfront" : "monthly", owner: "Subhan", kickoffBooked: addDays(s.today, 3), today: s.today })) }}>
            Simulate won deal in CRM
          </button>
          <button className="ml-auto flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-card" onClick={() => { if (window.confirm("Put the sample clients back and start over?")) reset() }}>
            <RotateCcw className="size-3.5" /> Reset demo
          </button>
        </div>
        <main className="flex w-full min-w-0 flex-col gap-5 p-6">
          {ready && access === "Viewer" && <div className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-secondary)]">You have view-only access. Buttons still show, but nothing you click changes anything.</div>}
          {!ready ? null : !canMoney(s) && MONEY_PAGES.some((x) => path.startsWith(x)) ? (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed bg-card px-6 py-14 text-center">
              <span className="text-lg font-semibold">Admins only</span>
              <span className="max-w-md text-sm text-[var(--text-secondary)]">Revenue, costs and retention are for Admins. Ask Subhan if you need a number from here.</span>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Suspense } from "react"
import { ArrowLeft, BarChart3, BookOpen, Bot, Briefcase, Clock, Eye, FileText, Home, Info, LayoutGrid, ListChecks, Lock, Network, Presentation, Mic, Settings, Sparkles, Target, TrendingUp, UserCheck, Users, Workflow } from "lucide-react"
import { AutomationsTab, ReportsView, TeamView, WorkTab } from "@/components/client/tabs"
import { PlaybookView } from "@/components/client/playbook"
import { PeopleView } from "@/components/client/people"
import { ExecView } from "@/components/client/exec"
import { AskView } from "@/components/client/ask"
import { MyWorkflows } from "@/components/client/member"
import { Gate, GetStarted } from "@/components/client/onboard"
import { InterviewView } from "@/components/client/interview"
import { SupportChat } from "@/components/client/support"
import { isExec, needsReconsent, onboardingDone, onboardingSteps } from "@/lib/setup"
import { scheduleFor } from "@/lib/client-data"
import { RosterView } from "@/components/client/roster"
import { GoalLevels, GoalsView } from "@/components/client/goals"
import { HowItWorks } from "@/components/client/how"
import { YourData } from "@/components/client/your-data"
import { MemberTour } from "@/components/client/member-tour"
import { savedStop, Tour, tourStops } from "@/components/client/tour"
import { MyTimeTab } from "@/components/client/mytime"
import { ClientSettings } from "@/components/client/settings"
import { ResultsView } from "@/components/results-view"
import { HomeTab } from "@/components/client/home"
import { InsightsHome } from "@/components/client/insights-home"
import { MIN_TEAM, scopeLabel, seatsInScope } from "@/lib/teams"
import { dayN, visibleWorkflows } from "@/lib/engine"
import { useStore } from "@/lib/store"
import { recordingNow, recStatus } from "@/lib/recording"
import { past90, phase, recurringMonth } from "@/lib/renewal"
import { cn } from "@/lib/utils"
import { Segmented } from "@/components/bits"

type Role = "Owner" | "Manager" | "Member"
// Pages open while setup is unfinished: the setup steps point to these.
const OPEN_DURING_SETUP = ["getstarted", "interview", "how", "settings", "roster", "goals"]

// Tabs: every page the client app has, with who may open it.
const NAV: { id: string; label: string; icon: typeof LayoutGrid; roles: Role[] }[] = [
  { id: "getstarted", label: "Get started", icon: ListChecks, roles: ["Owner", "Manager", "Member"] },
  { id: "insights", label: "Insights", icon: Home, roles: ["Owner", "Manager"] },
  { id: "team", label: "Overview", icon: LayoutGrid, roles: ["Owner", "Manager"] },
  { id: "exec", label: "Executive report", icon: Briefcase, roles: ["Owner", "Manager", "Member"] },
  { id: "me", label: "My time", icon: Clock, roles: ["Owner", "Manager", "Member"] },
  { id: "people", label: "People", icon: Users, roles: ["Owner", "Manager"] },
  { id: "roster", label: "Recording", icon: UserCheck, roles: ["Owner", "Manager"] },
  { id: "fitmap", label: "Fit Map", icon: Network, roles: ["Owner", "Manager"] },
  { id: "workflows", label: "Workflows", icon: BarChart3, roles: ["Owner", "Manager"] },
  { id: "processes", label: "Processes", icon: Workflow, roles: ["Owner", "Manager"] },
  { id: "myflows", label: "My workflows", icon: Workflow, roles: [] }, // members: inside My work since v19.2
  { id: "automations", label: "Agents and time back", icon: Bot, roles: ["Owner", "Manager"] },
  { id: "goals", label: "Goals", icon: Target, roles: ["Owner", "Manager"] },
  { id: "playbook", label: "Playbook", icon: BookOpen, roles: ["Owner", "Manager"] },
  { id: "reports", label: "Reports", icon: FileText, roles: ["Owner", "Manager"] },
  { id: "interview", label: "Interview", icon: Mic, roles: ["Owner", "Manager", "Member"] },
  { id: "ask", label: "Ask AI", icon: Sparkles, roles: ["Owner", "Manager"] },
  { id: "how", label: "How it works", icon: Info, roles: ["Owner", "Manager", "Member"] },
  { id: "settings", label: "Settings", icon: Settings, roles: ["Owner", "Manager", "Member"] },
]
// v19 menu: five areas plus AI and account. Each area holds tabs shown as a switch at the top.
const AREAS: { id: string; label: string; icon: typeof LayoutGrid; tabs: string[]; group?: string }[] = [
  { id: "getstarted", label: "Get started", icon: ListChecks, tabs: ["getstarted"] },
  { id: "home", label: "Home", icon: Home, tabs: ["insights", "team", "exec"] },
  { id: "me", label: "My time", icon: Clock, tabs: ["me"] },
  { id: "teamarea", label: "Team", icon: Users, tabs: ["people", "roster", "fitmap"], group: "Your business" },
  { id: "work", label: "Work", icon: Workflow, tabs: ["workflows", "processes", "myflows"], group: "Your business" },
  { id: "resultsarea", label: "Results", icon: TrendingUp, tabs: ["automations", "goals", "playbook", "reports"], group: "Your business" },
  { id: "interview", label: "Interview", icon: Mic, tabs: ["interview"], group: "AI" },
  { id: "ask", label: "Ask AI", icon: Sparkles, tabs: ["ask"], group: "AI" },
  { id: "how", label: "How it works", icon: Info, tabs: ["how"], group: "Account" },
  { id: "settings", label: "Settings", icon: Settings, tabs: ["settings"], group: "Account" },
]
const ROLES: Role[] = ["Owner", "Manager", "Member"]

export default function ClientAppPage() {
  return <Suspense fallback={null}><ClientApp /></Suspense>
}

function ClientApp() {
  const { id } = useParams<{ id: string }>()
  const sp = useSearchParams()
  const router = useRouter()
  const { s, logView } = useStore()
  const [navOpen, setNavOpen] = useState(false)
  const c = s.clients.find((x) => x.id === id)
  if (!c) return <p className="p-6">This client doesn&apos;t exist or isn&apos;t assigned to you. <Link className="underline" href="/">Back to Studio</Link></p>
  const tourAt = sp.get("tour")
  const touring = tourAt !== null
  // Presenter mode always shows the owner's view, so the money and every tab are there.
  const asked = sp.get("role") as Role
  const role: Role = touring || !ROLES.includes(asked) ? "Owner" : asked
  const me = c.seats[role === "Owner" ? 0 : role === "Manager" ? 1 : Math.min(3, c.seats.length - 1)]
  // Executives get one Executive report in place of My time; the owner can open everyone's.
  const exec = isExec(me)
  const done = onboardingDone(c, me, role, s.today) || !!c.prefs[me.id]?.checklist?.includes("complete")
  const allowed = NAV.filter((n) => n.roles.includes(role) && (n.id !== "exec" || role === "Owner" || exec) && (n.id !== "me" || !exec))
  // Members land on their own work (executives on their report); everyone else on Insights.
  const home = !done ? "getstarted" : role === "Member" ? (exec ? "exec" : "me") : "insights"
  const tab = allowed.some((n) => n.id === sp.get("tab")) ? sp.get("tab")! : home
  // Until setup is done, only the pages setup needs open: the steps point to Team, Goals and Settings.
  const gated = !done && !touring && !OPEN_DURING_SETUP.includes(tab)
  const can = (t: string) => allowed.some((n) => n.id === t)
  // Members see only their own things: My work, Your data, Settings. The interview stays in Get started.
  const menu = AREAS.filter((a) => a.tabs.some(can) && (a.id !== "getstarted" || !done) && !(role === "Member" && a.id === "interview"))
  const areaLabel = (a: (typeof AREAS)[number]) => (role === "Member" && a.id === "me" ? "My work" : role === "Member" && a.id === "how" ? "Your data" : a.label)
  const area = AREAS.find((a) => a.tabs.includes(tab)) ?? AREAS[1]
  const subs = area.tabs.filter(can)
  const locked = (a: (typeof AREAS)[number]) => !done && !touring && !a.tabs.some((t) => OPEN_DURING_SETUP.includes(t))
  const go = (t: string, cat?: string) => router.replace(`/client/${c.id}?role=${role}&tab=${t}${cat ? `&cat=${encodeURIComponent(cat)}` : ""}${touring ? `&tour=${tourAt}` : ""}`, { scroll: false })
  const tourTo = (i: number) => { const x = tourStops(c, s.today)[i]; router.replace(`/client/${c.id}?role=Owner&tab=${x.tab}${x.sub ? `&sub=${x.sub}` : ""}&tour=${i}`, { scroll: false }) }
  const exitTour = () => router.replace(`/client/${c.id}?role=Owner&tab=${tab}`, { scroll: false })
  const setRole = (r: Role) => { logView(c.id, r); router.replace(`/client/${c.id}?role=${r}`, { scroll: false }) }
  const n = dayN(c, s.today)
  const rec = recordingNow(c, c.seats, s.today)
  const collecting = n === null || visibleWorkflows(c, s.today).length === 0
  const title = areaLabel(area)

  return (
    <div className="flex min-h-screen flex-col">
      <div data-topbar className="z-30 flex flex-wrap md:sticky md:top-0 items-center gap-x-4 gap-y-2 bg-[var(--night)] px-5 py-2.5 text-sm text-[#e7e3da]">
        <Eye className="size-4 text-[var(--bronze-dark)]" />
        <span>Viewing <b>{c.name}</b> as</span>
        <div role="group" aria-label="Role" className="flex rounded-[10px] bg-white/8 p-0.5">
          {(["Owner", "Manager", "Member"] as Role[]).map((r) => <button key={r} aria-pressed={role === r} onClick={() => setRole(r)} className={cn("h-7 rounded-[8px] px-2.5 text-xs", role === r ? "bg-[var(--bronze-dark)] font-medium text-[var(--night)]" : "text-[#aaa69f] hover:text-white")}>{r}</button>)}
        </div>
        <span className="text-xs text-[#929088]">Read only · logged in Settings</span>
        {c.demo && <span className="rounded-full bg-[var(--bronze-dark)]/20 px-2.5 py-0.5 text-xs font-medium text-[var(--bronze-dark)]">Sample agency · made-up numbers</span>}
        <button onClick={() => (touring ? exitTour() : tourTo(Math.min(savedStop(c.id), tourStops(c, s.today).length - 1)))} aria-pressed={touring} className={cn("ml-auto inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-xs font-medium", touring ? "bg-[var(--bronze-dark)] text-[var(--night)]" : "border border-white/15 hover:bg-white/8")}><Presentation className="size-3.5" />{touring ? "Exit demo" : "Present"}</button>
        <Link href={`/clients/${c.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-white/15 px-3 text-xs hover:bg-white/8"><ArrowLeft className="size-3.5" />Back to Studio</Link>
      </div>

      <div className="flex flex-1 flex-wrap">
        <nav aria-label="Headroom" className="flex max-w-full flex-[1_1_220px] flex-col gap-6 border-r bg-card px-4 py-5">
          <div className="flex items-center gap-2.5 px-2">
            <span aria-hidden className="grid size-7 place-items-center rounded-[9px] bg-[var(--graphite)]"><span className="size-2.5 rounded-full bg-[var(--bronze-dark)]" /></span>
            <div className="leading-tight"><div className="text-[15px] font-semibold">Headroom</div><div className="text-xs text-[var(--text-muted)]">{c.name}</div></div>
          </div>
          {/* On a phone the menu folds into one button, so the page starts on the first screen. */}
          <button onClick={() => setNavOpen(!navOpen)} aria-expanded={navOpen} className="flex h-10 items-center justify-between rounded-xl border px-3 text-sm font-medium md:hidden">
            <span>{areaLabel(area)}</span><span className="text-xs text-[var(--text-muted)]">{navOpen ? "Close" : "Menu"}</span>
          </button>
          <div className={cn("grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1 md:grid", navOpen ? "grid" : "hidden")}>
            {menu.map((x, i) => (
              <div key={x.id} className="contents">
              {x.group && x.group !== menu[i - 1]?.group && <span className="col-span-full px-3 pt-3 text-xs text-[var(--text-muted)]">{x.group}</span>}
              <button onClick={() => { go(x.tabs.find(can)!); setNavOpen(false) }} title={locked(x) ? "Opens once setup is done" : undefined} aria-current={area.id === x.id ? "page" : undefined} className={cn("flex h-10 items-center gap-3 rounded-xl px-3 text-left text-sm", area.id === x.id ? "bg-[var(--surface-2)] font-medium" : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]")}>
                <x.icon className={cn("size-4", area.id === x.id && "text-[var(--bronze)]")} />{areaLabel(x)}
                {locked(x) && <Lock className="ml-auto size-3.5 text-[var(--text-muted)]" aria-label="Opens once setup is done" />}
              </button>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-1 rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[var(--text-secondary)]">
            {role === "Member" ? <span>{recStatus(c, me, s.today).status} · {scheduleFor(c, me.id).start} to {scheduleFor(c, me.id).end}</span> : <span>{n === null ? "Starts at kickoff" : past90(c, s.today) ? (phase(c, s.today) === "recurring" ? `Monthly plan · month ${recurringMonth(c, s.today)}` : "The 90 days are done") : `Day ${n} of 90`} · {rec.on} of {rec.of} recording</span>}
            {done && <button onClick={() => go("getstarted")} className="w-fit text-[var(--text-muted)] hover:underline">Setup complete</button>}
          </div>
        </nav>

        <main className={cn("flex min-w-0 flex-[999_1_560px] flex-col gap-5 p-6", touring && "pb-[440px] lg:pb-80")}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="text-2xl">{title}</h1>
            {!gated && ["team", "people", "workflows", "processes", "roster", "me"].includes(tab) && <span className="text-xs text-[var(--text-muted)]">{tab === "roster" ? "Last 7 days" : "Last 14 days"} · updated 6:04am</span>}
          </div>
          {needsReconsent(c, me) && tab !== "getstarted" && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--status-warning)] bg-[var(--watch-bg)] px-4 py-3 text-sm text-[var(--watch-fg)]"><span className="flex-1">The consent form changed to {c.consentVersion}. Please read it and agree again.</span><button onClick={() => go("getstarted")} className="font-medium underline">Review it</button></div>}
          {scheduleFor(c, me.id).preset === "247" && <div className="rounded-2xl border border-[var(--status-warning)] bg-[var(--watch-bg)] px-4 py-3 text-sm text-[var(--watch-fg)]">Your hours are set to 24/7. You can pause any time from the menu bar.</div>}
          {subs.length > 1 && !gated && <Segmented label={area.label} value={tab} onChange={(v) => go(v)} options={subs.map((t) => ({ id: t, label: NAV.find((n) => n.id === t)!.label }))} />}
          {!gated && collecting && tab === "team" && (
            <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border bg-card p-5">
              <span className="relative grid size-10 place-items-center"><span className="absolute size-10 animate-ping rounded-full bg-[var(--bronze)]/15" /><span className="size-3 rounded-full bg-[var(--bronze)]" /></span>
              <div className="flex flex-1 flex-col">
                <span className="font-semibold">Collecting</span>
                <span className="text-sm text-[var(--text-secondary)]">{n === null ? "Your kickoff starts the 90 days. Install Shadow on the day of kickoff." : `${rec.on} of ${rec.of} people recording. Your first findings show up after we review them, usually in week one.`}</span>
              </div>
            </div>
          )}
          {!gated && tab === "team" && <HomeTab c={c} go={go} rates={role === "Owner"} people={role === "Owner"} scope={role === "Owner" || seatsInScope(c, role, me).length < MIN_TEAM ? undefined : { seats: seatsInScope(c, role, me), label: scopeLabel(c, role, me) }} />}
          {!gated && tab === "insights" && <InsightsHome c={c} role={role} me={me} go={go} />}
          {!gated && tab === "me" && (role === "Member"
            ? <>{!c.prefs[me.id]?.checklist?.includes("walkthrough") && <MemberTour c={c} me={me} go={go} />}<MyTimeTab c={c} me={me} money={false} compact found={<div className="flex flex-col gap-3"><h2 className="text-lg">What Shadow found in your work</h2><MyWorkflows c={c} me={me} /></div>} /></>
            : <MyTimeTab c={c} me={me} money={role === "Owner"} />)}
          {!gated && tab === "goals" && <div className="flex flex-col gap-5"><h2 className="text-lg">Company goals</h2><GoalsView c={c} role={role} me={me} /><GoalLevels c={c} role={role} me={me} /></div>}
          {tab === "how" && (role === "Member" ? <YourData c={c} me={me} go={go} /> : <HowItWorks c={c} money />)}
          {!gated && tab === "workflows" && <WorkTab key={`${sp.get("cat") ?? "all"}-${role}-${c.org ?? "function"}`} c={c} only="workflows" initialCat={sp.get("cat") ?? undefined} role={role} me={me} />}
          {!gated && tab === "processes" && <WorkTab c={c} only="processes" role={role} me={me} />}
          {!gated && tab === "playbook" && <PlaybookView c={c} role={role} me={me} />}
          {!gated && tab === "roster" && <RosterView c={c} role={role} me={me} />}
          {!gated && tab === "people" && <PeopleView c={c} role={role} me={me} />}
          {!gated && tab === "exec" && <ExecView c={c} role={role} me={me} />}
          {!gated && tab === "ask" && <AskView c={c} role={role} me={me} />}
          {gated && <Gate go={go} />}
          {tab === "getstarted" && (role === "Member"
            ? <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border bg-card p-6"><h2 className="text-lg">Your setup happens in a short chat with your guide</h2><p className="text-sm text-[var(--text-secondary)]">Sign in, the app, a quick check, the Chrome extension and your 5-minute interview, one step at a time. About 10 minutes.</p><Link href={`/join/${c.id}`} className="inline-flex h-9 items-center rounded-[10px] bg-[var(--graphite)] px-4 text-sm font-medium text-white">{onboardingSteps(c, me, "Member", s.today).some((x) => x.done) ? "Continue setup" : "Start setup"}</Link></div>
            : <GetStarted c={c} me={me} role={role} go={go} />)}
          {tab === "interview" && role === "Member" && (!done
            ? <button onClick={() => go("getstarted")} className="w-fit text-sm font-medium text-[var(--bronze)] hover:underline">Back to setup</button>
            : !c.prefs[me.id]?.checklist?.includes("walkthrough") && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--status-good)] bg-[var(--good-bg)] px-4 py-3 text-sm"><span className="flex-1">That was the last step. You&apos;re all set, {me.name.split(" ")[0]}.</span><button onClick={() => go("me")} className="h-8 rounded-[10px] bg-[var(--graphite)] px-3 text-sm font-medium text-white">Show me around</button></div>)}
          {tab === "interview" && <InterviewView key={me.id} c={c} me={me} owner={role === "Owner"} />}
          {!gated && tab === "myflows" && <MyWorkflows c={c} me={me} />}
          {!gated && tab === "fitmap" && <TeamView c={c} />}
          {!gated && tab === "automations" && <div className="flex flex-col gap-5"><ResultsView c={c} view={role === "Owner" ? "owner" : "manager"} who={me.name} /><AutomationsTab c={c} list /></div>}
          {!gated && tab === "reports" && <ReportsView c={c} />}
          {tab === "settings" && <ClientSettings key={sp.get("sub") ?? ""} c={c} role={role} me={me} />}
        </main>
      </div>
      {/* During member setup the guide beside the steps answers questions, so the corner chat waits. */}
      {!touring && !(role === "Member" && tab === "getstarted") && <SupportChat c={c} me={me} />}
      {touring && <Tour c={c} step={Number(tourAt) || 0} go={tourTo} exit={exitTour} />}
    </div>
  )
}

"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AlertTriangle, Database, Eye, Hammer, LayoutDashboard, MessageSquare, PauseCircle, Presentation, Rocket, Settings, TrendingUp } from "lucide-react"
import { AutopilotSwitch, CommonQuestions, Funnel, Outbox, PeopleTable } from "@/components/autopilot"
import { ChannelMood, SlackQueue } from "@/components/slack-queue"
import { decisions, outbox } from "@/lib/onboarding"
import { needsYou, slackMessages } from "@/lib/slack"
import { ActionRow } from "@/components/action-row"
import { DeliverablesTab } from "@/components/cockpit/deliverables"
import { EvidenceTab } from "@/components/cockpit/evidence"
import { ExportTab } from "@/components/cockpit/export"
import { PipelineTab } from "@/components/cockpit/pipeline"
import { FitTab } from "@/components/cockpit/fit"
import { GoalsTab } from "@/components/cockpit/goals"
import { PlaybookTab } from "@/components/cockpit/playbook"
import { ReportsTab } from "@/components/cockpit/reports"
import { ReviewTab } from "@/components/cockpit/review"
import { ClientSettings } from "@/components/client/settings"
import { RosterView } from "@/components/client/roster"
import { CostsTab, HealthTab } from "@/components/cockpit/money"
import { RenewalCard } from "@/components/cockpit/renewal"
import { past90, phase, recurringMonth } from "@/lib/renewal"
import { canMoney, MONEY_TABS } from "@/lib/access"
import { SubscriptionTab } from "@/components/cockpit/subscription"
import { ResultsView } from "@/components/results-view"
import { OPEN } from "@/lib/requests"
import { PersonPicker, StaffPicker } from "@/components/person-picker"
import { GPill, Meter, Pill, ReqIcon, reqWord, Section } from "@/components/bits"
import { ProgressChart } from "@/components/progress-chart"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { addDays, diffDays, fmt } from "@/lib/dates"
import { openActions, agentStatus, dateOfDay, deliverables, guarantees, installed, requirements, reviewQueue, risk, seatStats, silent, stage, STAGES, TARGET, weekly } from "@/lib/engine"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { AgentStatus, Client, ISODate } from "@/lib/types"

export default function CockpitPage() {
  return <Suspense fallback={null}><Cockpit /></Suspense>
}

// Seven sections, each with a few sub-tabs. The URL keeps the sub-tab (?tab=), so old links work.
const SECTIONS: { id: string; label: string; icon: typeof LayoutDashboard; tabs: [string, string][] }[] = [
  { id: "today", label: "Overview", icon: LayoutDashboard, tabs: [["overview", "Next actions"], ["progress", "Progress"], ["deliverables", "Calendar"], ["activity", "Log"]] },
  { id: "onboard", label: "Onboarding", icon: Rocket, tabs: [["autopilot", "Autopilot"], ["seats", "People and installs"], ["onboarding", "Setup checklist"]] },
  { id: "slack", label: "Slack", icon: MessageSquare, tabs: [["slack", "Messages"], ["requests", "Requests"]] },
  { id: "deliver", label: "Delivery", icon: Hammer, tabs: [["review", "Review queue"], ["goals", "Goals"], ["playbook", "Playbook"], ["fit", "Fit Map"], ["build", "Build plan"], ["reports", "Reports"]] },
  { id: "results", label: "Results", icon: TrendingUp, tabs: [["results", "Results"], ["health", "Health"]] },
  { id: "data", label: "Data", icon: Database, tabs: [["costs", "Costs and margin"], ["pipeline", "Pipeline"], ["evidence", "Evidence"]] },
  { id: "settings", label: "Settings", icon: Settings, tabs: [["settings", "Client settings"], ["subscription", "Subscription"], ["export", "Workbook export"]] },
]

function Cockpit() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const tab = useSearchParams().get("tab") ?? "overview"
  const { s, update, assignClient, logView } = useStore()
  const c = s.clients.find((x) => x.id === id)
  if (!c) return <p>This client doesn&apos;t exist or isn&apos;t assigned to you. <Link href="/" className="underline">Back to clients</Link></p>
  const t = s.today
  const g = guarantees(c, t)
  const r = risk(c, t)
  const reqs = requirements(c, t)
  const st = seatStats(c, t)
  const acts = openActions(s, c)
  const stg = STAGES.find((x) => x.id === stage(c, t))!
  // Revenue, margin, churn health and billing are for Admins.
  const sections = SECTIONS.map((x) => ({ ...x, tabs: x.tabs.filter(([k]) => canMoney(s) || !MONEY_TABS.includes(k)) }))
  const section = sections.find((x) => x.tabs.some(([k]) => k === tab)) ?? sections[0]
  const go = (k: string) => router.replace(`/clients/${c.id}?tab=${k}`, { scroll: false })
  const waiting = decisions(s, outbox(s, c)).length
  const slackOpen = slackMessages(c, t).filter((m) => needsYou(s, m)).length

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-card)] border bg-card p-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-secondary)]"><Link href="/" className="underline-offset-2 hover:underline">Clients</Link> / {c.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl">{c.name}</h1>
            {phase(c, t) === "ended" ? <Pill t="muted">{c.renewal?.stage === "Lost" ? "Did not renew" : "Cancelled"}</Pill> : r.length ? <Pill t="bad"><AlertTriangle className="size-3" />At risk</Pill> : <Pill t="good">On track</Pill>}
            <Pill t="info">{stg.name}</Pill>
            {c.demo && <Pill t="muted">Sample agency</Pill>}
          </div>
          <span className="text-sm tabular-nums text-[var(--text-secondary)]">
            {g.n === null ? `Signed ${fmt(c.signedDate)} · kickoff ${c.kickoffBooked ? fmt(c.kickoffBooked) : "not booked"}` : past90(c, t) ? (phase(c, t) === "recurring" ? `Monthly plan, month ${recurringMonth(c, t)} · the 90 days ended ${fmt(g.day90!)}` : phase(c, t) === "ended" ? (c.renewal?.stage === "Lost" ? `Did not renew · the 90 days ended ${fmt(g.day90!)}` : `Cancelled ${fmt(c.sub!.cancelAt!)}`) : `Renewal undecided · the 90 days ended ${fmt(g.day90!)} · nothing is billing`) : `Day ${g.n} of 90 · ${c.pauses.reduce((a, p) => a + p.days, 0)} days paused · Day 30 ${fmt(g.day30!)} · Day 90 ${fmt(g.day90!)}`}
          </span>
          {r.length > 0 && <span className="text-xs text-[var(--delta-bad)]">{r.join(" · ")}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" title="Not wired in the prototype">Linear · {c.linearKey}</Button>
          <Button variant="outline" size="sm" title="Not wired in the prototype">CRM deal</Button>
          <Button variant="outline" size="sm" title="Not wired in the prototype">#{c.slackSlug}-internal</Button>
          <PauseClock c={c} />
          <PersonPicker label={`Owner for ${c.name}`} value={c.owner} disabled={!canMoney(s)} onChange={(v) => assignClient(c.id, v)} />
          <StaffPicker c={c} />
          <Link href={`/client/${c.id}`} onClick={() => logView(c.id, "Owner")} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[var(--graphite)] px-3 text-sm font-medium text-white hover:opacity-90"><Eye className="size-4" /> View as client</Link>
          {c.demo && <Link href={`/client/${c.id}?role=Owner&tab=how&tour=0`} onClick={() => logView(c.id, "Owner")} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[var(--bronze)] px-3 text-sm font-medium text-white hover:opacity-90"><Presentation className="size-4" /> Start demo</Link>}
        </div>
      </div>

      <nav aria-label="Client sections" className="flex flex-col gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5">
          {sections.map((sec) => {
            const Icon = sec.icon
            const on = sec.id === section.id
            const count = sec.id === "onboard" ? waiting : sec.id === "slack" ? slackOpen : sec.id === "deliver" ? reviewQueue(c, t).length : sec.id === "today" ? deliverables(c, t).filter((d) => d.status === "overdue").length : 0
            return (
              <button key={sec.id} onClick={() => go(sec.tabs[0][0])} aria-current={on ? "page" : undefined}
                className={cn("flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm transition-colors", on ? "bg-[var(--graphite)] font-medium text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]")}>
                <Icon className="size-4" />{sec.label}
                {count > 0 && <span className={cn("min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums", on ? "bg-white/20 text-white" : "bg-[var(--bad-bg)] text-[var(--delta-bad)]")}>{count}</span>}
              </button>
            )
          })}
        </div>
        {section.tabs.length > 1 && (
          <div className="flex flex-wrap gap-1 px-1">
            {section.tabs.map(([k, label]) => (
              <button key={k} onClick={() => go(k)} aria-current={tab === k ? "page" : undefined}
                className={cn("h-8 rounded-full px-3 text-sm", tab === k ? "bg-[var(--seq-100)] font-medium text-[var(--seq-900)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
                {label === "People and installs" ? `People and installs ${st.installed}/${st.scope}` : label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <Tabs value={tab}>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Section title="Next actions" sub={`${acts.length} open · each button does the work or marks it done`}>
            {acts.length ? acts.map((a) => <ActionRow key={a.key} a={a} />) : <p className="text-sm text-[var(--text-secondary)]">Nothing open. Move the day forward to see what comes next.</p>}
          </Section>
          <div className="flex min-w-0 flex-col gap-4">
            {(g.n ?? 0) >= 60 && <RenewalCard c={c} />}
            <Section title="Guarantees">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between"><span className="text-xs text-[var(--text-secondary)]">Day 30</span><GPill g={g.d30} /></div>
                  <span className="text-sm">Hours found a week</span>
                  <span className="text-2xl font-semibold tabular-nums">{g.found} <span className="text-sm font-normal text-[var(--text-secondary)]">of {TARGET}</span></span>
                  <Meter value={g.found} max={60} target={TARGET} t={g.found >= TARGET ? "good" : "info"} />
                  <span className="mt-1 text-sm">First agent live: <b>{g.agentBy30 ? "Yes" : "Not yet"}</b></span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between"><span className="text-xs text-[var(--text-secondary)]">Day 90</span><GPill g={g.d90} /></div>
                  <span className="text-sm">Hours back a week</span>
                  <span className="text-2xl font-semibold tabular-nums">{g.back} <span className="text-sm font-normal text-[var(--text-secondary)]">of {TARGET}</span></span>
                  <Meter value={g.back} max={60} target={TARGET} t={g.d90 === "at_risk" ? "bad" : "info"} />
                  <span className="mt-1 text-sm">Projected at day 90: <b className={g.proj < TARGET ? "text-[var(--delta-bad)]" : ""}>{g.proj} h</b></span>
                </div>
              </div>
            </Section>
            <Section title="Requirements for Success" sub="From the agreement. Missing one voids the guarantees." right={<span className="text-xs font-medium tabular-nums text-[var(--text-secondary)]">{reqs.filter((q) => q.status === "met").length} of 7 met</span>}>
              {reqs.map((q) => (
                <div key={q.n} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 border-t py-2 text-sm first:border-t-0">
                  <ReqIcon s={q.status} />
                  <span className="leading-snug">{q.name}<span className="block text-xs text-[var(--text-muted)]">{q.source}</span></span>
                  <span className="text-right text-xs text-[var(--text-secondary)]"><b className="block text-[var(--text-primary)]">{reqWord[q.status]}</b>{q.detail}</span>
                </div>
              ))}
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="autopilot" className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Section title="Onboarding progress" sub="People who reached each step"><Funnel clients={[c]} /></Section>
            <div className="flex flex-col gap-4"><AutopilotSwitch c={c} /><PeopleTable c={c} /></div>
          </div>
          <Outbox clients={[c]} />
          <CommonQuestions />
          <p className="text-xs text-[var(--text-muted)]">Edit the messages themselves in <Link href="/onboarding" className="underline">Onboarding &gt; Messages</Link>. Changes apply to every client.</p>
        </TabsContent>
        <TabsContent value="slack" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <SlackQueue clientId={c.id} />
          <ChannelMood c={c} />
        </TabsContent>
        <TabsContent value="results"><ResultsView c={c} view="admin" /></TabsContent>
        {canMoney(s) && <>
          <TabsContent value="health"><HealthTab c={c} /></TabsContent>
          <TabsContent value="costs"><CostsTab c={c} /></TabsContent>
          <TabsContent value="subscription"><SubscriptionTab c={c} /></TabsContent>
        </>}
        <TabsContent value="settings"><ClientSettings c={c} role="Admin" /></TabsContent>
        <TabsContent value="requests">
          <Section title="Requests from this client" sub="Everything they've asked for. Triage and Send to Linear from the Requests inbox." right={<Link href="/requests" className="text-sm font-medium text-[var(--bronze)] hover:underline">Open inbox</Link>}>
            {s.requests.filter((r) => r.clientId === c.id).length === 0 && <p className="text-sm text-[var(--text-muted)]">Nothing yet.</p>}
            {s.requests.filter((r) => r.clientId === c.id).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
                <span className="min-w-48 flex-1">{r.title}<span className="block text-xs text-[var(--text-muted)]">{r.kind} · {r.from} · {fmt(r.created)}</span></span>
                {r.linear && <span className="font-mono text-xs text-[var(--text-muted)]">{r.linear.id}</span>}
                <Pill t={OPEN.includes(r.status) ? "warn" : r.status === "Done" ? "good" : "muted"}>{r.status}</Pill>
              </div>
            ))}
          </Section>
        </TabsContent>
        <TabsContent value="onboarding"><Onboarding c={c} /></TabsContent>
        <TabsContent value="seats" className="flex flex-col gap-4"><RosterView c={c} role="Admin" /><Seats c={c} /></TabsContent>
        <TabsContent value="build"><Build c={c} /></TabsContent>
        <TabsContent value="progress">
          <Section title="Weekly progress" sub="End of each week of the 90 days. Move the simulated day forward to watch it fill in.">
            <ProgressChart data={weekly(c, t)} />
            <Table className="mt-3">
              <TableHeader><TableRow><TableHead>Week</TableHead><TableHead>Ends</TableHead><TableHead className="text-right">Hours found / wk</TableHead><TableHead className="text-right">Hours back / wk</TableHead></TableRow></TableHeader>
              <TableBody>
                {weekly(c, t).map((w) => (
                  <TableRow key={w.week}><TableCell>Week {w.week}</TableCell><TableCell>{fmt(w.date)}</TableCell><TableCell className="text-right tabular-nums">{w.found}</TableCell><TableCell className="text-right tabular-nums">{w.back}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>
        <TabsContent value="review"><ReviewTab c={c} /></TabsContent>
        <TabsContent value="goals"><GoalsTab c={c} /></TabsContent>
        <TabsContent value="playbook"><PlaybookTab c={c} /></TabsContent>
        <TabsContent value="fit"><FitTab c={c} /></TabsContent>
        <TabsContent value="reports"><ReportsTab c={c} /></TabsContent>
        <TabsContent value="deliverables"><DeliverablesTab c={c} /></TabsContent>
        <TabsContent value="export"><ExportTab c={c} /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab c={c} /></TabsContent>
        <TabsContent value="evidence"><EvidenceTab c={c} /></TabsContent>
        <TabsContent value="activity">
          <Section title="Activity log" sub="Every stage change, nudge, pause and deliverable">
            {c.log.map((l, i) => (
              <div key={i} className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 border-t py-2 text-sm first:border-t-0"><span className="font-mono text-xs text-[var(--text-secondary)]">{fmt(l.date)}</span><span>{l.text}</span></div>
            ))}
          </Section>
        </TabsContent>
      </Tabs>
    </>
  )

  function Onboarding({ c }: { c: Client }) {
    const n = g.n
    const items: { label: string; on: boolean; set: (v: boolean) => Partial<Client>; note?: string }[] = [
      { label: "Agreement signed", on: c.agreementSigned, set: (v) => ({ agreementSigned: v }) },
      { label: "First payment in", on: c.paymentIn, set: (v) => ({ paymentIn: v }) },
      { label: "Kickoff held", on: !!c.kickoffDate, set: (v) => ({ kickoffDate: v ? t : null }), note: c.kickoffDate ? fmt(c.kickoffDate) : c.kickoffBooked ? `Booked ${fmt(c.kickoffBooked)}` : undefined },
      { label: "Rate baseline signed (Req. 3)", on: !!c.baselineSigned, set: (v) => ({ baselineSigned: v ? t : null }) },
      { label: "Goals captured", on: c.goalsCaptured, set: (v) => ({ goalsCaptured: v }) },
      { label: "Teams confirmed with the owner", on: !!c.teamsConfirmed, set: (v) => ({ teamsConfirmed: v ? t : null }), note: c.teamsConfirmed ? fmt(c.teamsConfirmed) : "Suggested from job titles and the Fit Map" },
      { label: "Slack connected", on: c.slackConnected, set: (v) => ({ slackConnected: v }) },
      { label: "Consent from everyone (Req. 4)", on: st.consent === st.scope, set: (v) => ({ seats: c.seats.map((x) => ({ ...x, consent: v })) }), note: `${st.consent} of ${st.scope}` },
      { label: "Viktor installed or admin access (Req. 2)", on: !!c.viktorAccess, set: (v) => ({ viktorAccess: v ? t : null }), note: dateOfDay(c, 7) ? `Due ${fmt(dateOfDay(c, 7)!)}` : undefined },
      { label: "Culture Intelligence survey", on: st.ci === st.scope, set: (v) => ({ seats: c.seats.map((x) => ({ ...x, ciSurvey: v })) }), note: `${st.ci} of ${st.scope}` },
      { label: "Readout held with the owner (Req. 5)", on: c.readoutAttended, set: (v) => ({ readoutAttended: v }), note: n !== null ? `Day ${c.readoutDay}` : undefined },
      { label: "Reviewed workflows published", on: c.workflowsPublished, set: (v) => ({ workflowsPublished: v }) },
      { label: "Day-90 review held", on: c.day90Attended, set: (v) => ({ day90Attended: v }) },
      { label: "Renewal opened in the CRM", on: c.renewalOpened, set: (v) => ({ renewalOpened: v }) },
    ]
    return (
      <Section title="Onboarding and 90-day checklist" sub="Tick to test. Requirements and risk recalculate immediately.">
        <div className="grid gap-1 sm:grid-cols-2">
          {items.map((it) => (
            <label key={it.label} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-[var(--surface-2)]">
              <Checkbox checked={it.on} onCheckedChange={(v) => (v || window.confirm(`Untick "${it.label}"? This can move the client back a stage.`)) && update(c.id, (x, today) => ({ ...x, ...it.set(!!v), log: [{ date: today, text: `${it.label}: ${v ? "done" : "undone"}` }, ...x.log] }))} />
              <span className="flex-1 text-sm">{it.label}</span>
              {it.note && <span className="text-xs text-[var(--text-secondary)]">{it.note}</span>}
            </label>
          ))}
        </div>
      </Section>
    )
  }

  function Seats({ c }: { c: Client }) {
    return (
      <Section title="Seats and computers" sub="Make a computer go silent to test the alerts, or mark installs by hand.">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Role</TableHead><TableHead>Install</TableHead><TableHead>Data</TableHead><TableHead>Consent</TableHead><TableHead>Culture Intelligence</TableHead><TableHead className="text-right">Test</TableHead></TableRow></TableHeader>
            <TableBody>
              {c.seats.map((x) => {
                const inst = installed(x, t)
                const sil = silent(x, t)
                const set = (patch: object, text: string) => update(c.id, (cc, today) => ({ ...cc, seats: cc.seats.map((y) => (y.id === x.id ? { ...y, ...patch } : y)), log: [{ date: today, text }, ...cc.log] }))
                return (
                  <TableRow key={x.id}>
                    <TableCell className="font-medium">{x.name}</TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{x.role}</TableCell>
                    <TableCell>{inst ? <Pill t="good">Installed {fmt(x.installAt!)}</Pill> : x.installAt ? <Pill t="info">Planned {fmt(x.installAt)}</Pill> : <Pill t="muted">Not installed</Pill>}</TableCell>
                    <TableCell>{!inst ? "-" : sil ? <Pill t="bad">Silent</Pill> : <Pill t="good">Active</Pill>}</TableCell>
                    <TableCell><Checkbox checked={x.consent} onCheckedChange={(v) => set({ consent: !!v }, `${x.name} consent ${v ? "collected" : "removed"}`)} aria-label={`Consent for ${x.name}`} /></TableCell>
                    <TableCell><Checkbox checked={x.ciSurvey} onCheckedChange={(v) => set({ ciSurvey: !!v }, `${x.name} survey ${v ? "done" : "not done"}`)} aria-label={`Survey for ${x.name}`} /></TableCell>
                    <TableCell className="text-right">
                      {!inst ? <Button size="xs" variant="outline" onClick={() => set({ installAt: t }, `${x.name} installed`)}>Mark installed</Button>
                        : sil ? <Button size="xs" variant="outline" onClick={() => set({ silentTo: t }, `${x.name} sending data again`)}>Fix</Button>
                        : <Button size="xs" variant="ghost" onClick={() => set({ silentFrom: t, silentTo: null }, `${x.name} went silent`)}>Make silent</Button>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Section>
    )
  }

  function Build({ c }: { c: Client }) {
    const label: Record<AgentStatus, [string, "good" | "bad" | "info" | "muted" | "warn"]> = {
      proposed: ["Proposed", "muted"], approved: ["Approved", "muted"], building: ["Building", "info"], qa: ["In QA", "warn"], qa_failing: ["QA failing", "bad"], live: ["Live", "good"],
    }
    return (
      <Section title="Build plan" sub={`${c.agents.filter((a) => agentStatus(a, c, t) === "live").length} of ${c.agents.length} agents live. Status follows the plan; mark live or failing to test.`}>
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead className="text-right">Baseline h/wk</TableHead><TableHead className="text-right">Saves h/wk</TableHead><TableHead className="text-right">Planned live</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Test</TableHead></TableRow></TableHeader>
            <TableBody>
              {c.agents.map((a) => {
                const stt = agentStatus(a, c, t)
                const set = (patch: object, text: string) => update(c.id, (cc, today) => ({ ...cc, agents: cc.agents.map((y) => (y.id === a.id ? { ...y, ...patch } : y)), log: [{ date: today, text }, ...cc.log] }))
                const plannedDate = dateOfDay(c, a.plannedLiveDay)
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}<span className="ml-2 font-mono text-xs text-[var(--text-muted)]">{a.linear}</span></TableCell>
                    <TableCell className="text-right tabular-nums">{a.baselineHrsWk}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(a.baselineHrsWk * a.savesPct * 10) / 10}</TableCell>
                    <TableCell className="text-right">Day {a.plannedLiveDay}{plannedDate ? ` · ${fmt(plannedDate)}` : ""}</TableCell>
                    <TableCell><Pill t={label[stt][1]}>{label[stt][0]}</Pill>{stt === "qa" && !c.viktorAccess && (g.n ?? 0) >= a.plannedLiveDay ? <span className="ml-2 text-xs text-[var(--delta-bad)]">waiting on Viktor</span> : null}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {stt !== "live" && <Button size="xs" variant="outline" onClick={() => set({ liveDate: t, blocked: null, manual: null }, `${a.name} marked live`)}>Mark live</Button>}
                        {stt !== "qa_failing" && stt !== "live" && <Button size="xs" variant="ghost" onClick={() => set({ blocked: "qa_failing", manual: "qa_failing" }, `${a.name} failed QA`)}>Fail QA</Button>}
                        {stt === "live" && <Button size="xs" variant="ghost" onClick={() => set({ liveDate: null, manual: "qa", blocked: null }, `${a.name} pulled back to QA`)}>Pull back</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Section>
    )
  }
}

function PauseClock({ c }: { c: Client }) {
  const { s, update } = useStore()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState(2)
  const [reason, setReason] = useState("")
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}><PauseCircle /> Pause clock</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pause the 90-day clock</DialogTitle>
          <DialogDescription>Only for delays the client causes. Both guarantee dates move by the same number of days, and the client is told in Slack.</DialogDescription>
        </DialogHeader>
        {c.pauses.length > 0 && (
          <div className="flex flex-col gap-1 rounded-xl bg-[var(--surface-2)] p-3 text-sm">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Pauses so far</span>
            {c.pauses.map((p, i) => {
              const end = addDays(p.start, p.days)
              const ahead = p.start > s.today
              const running = !ahead && s.today < end
              // A pause can be taken back before it starts, or ended early while it runs; past ones stay as they were.
              const undo = (x: Client, today: ISODate): Client => ({
                ...x,
                pauses: ahead ? x.pauses.filter((_, j) => j !== i) : x.pauses.map((q, j) => (j === i ? { ...q, days: diffDays(today, q.start) } : q)).filter((q) => q.days > 0),
                log: [{ date: today, text: ahead ? `Clock pause taken back: ${p.reason}` : `Clock pause ended early: ${p.reason}` }, ...x.log],
              })
              return (
                <span key={i} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{fmt(p.start)} · {p.days} {p.days === 1 ? "day" : "days"} · {p.reason}</span>
                  {(ahead || running) && <Button size="xs" variant="outline" onClick={() => update(c.id, undo)}>{ahead ? "Take back" : "End today"}</Button>}
                </span>
              )
            })}
          </div>
        )}
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="pd">Days</Label><Input id="pd" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>
          <div className="grid gap-1.5"><Label htmlFor="pr">Reason</Label><Input id="pr" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What the client is waiting on" /></div>
        </div>
        <DialogFooter>
          <Button disabled={!reason.trim() || days < 1} onClick={() => { update(c.id, (x, t) => ({ ...x, pauses: [...x.pauses, { start: addDays(t, 1), days, reason: reason.trim() }], log: [{ date: t, text: `Clock paused ${days} days: ${reason.trim()}` }, ...x.log] })); setOpen(false); setReason("") }}>Pause {days} days</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

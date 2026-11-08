"use client"

import Link from "next/link"
import { useState } from "react"
import { Kpi, PageHeader, Pill, Section, Segmented } from "@/components/bits"
import { CommonQuestions, Funnel, Outbox, SequenceEditor } from "@/components/autopilot"
import { decisions, outbox, people } from "@/lib/onboarding"
import { useStore } from "@/lib/store"
import { CheckCircle2, Clock, MailWarning, UserCheck } from "lucide-react"
import { APP } from "@/lib/flags"

export default function Onboarding() {
  const { s } = useStore()
  const [view, setView] = useState("outbox")
  const active = s.clients.filter((c) => c.kickoffDate && c.kickoffDate <= s.today && people(c, s.today).some((p) => p.stage !== "live"))
  const all = s.clients.flatMap((c) => people(c, s.today))
  const due = decisions(s, s.clients.flatMap((c) => outbox(s, c)))
  return (
    <>
      <PageHeader title="Onboarding" sub="Every person on every client, from invite to live. The autopilot sends the nudges; you approve the personal ones and do the calls." />
      <div className="rounded-2xl border border-[var(--watch-bg)] bg-[var(--watch-bg)]/40 px-4 py-3 text-sm">
        <b>What the beta taught us.</b> People hold off installing until they know what {APP} sees on their own laptop: what it captures, Chrome profiles, pausing, permissions. The autopilot answers those up front, follows up as Subhan, and makes sure nobody is stuck for more than 3 days without a person reaching out.
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi icon={<CheckCircle2 />} hue="#1baf7a" label="Live" value={`${all.filter((p) => p.stage === "live").length}/${all.length}`} note="Recording for 3+ days" />
        <Kpi icon={<Clock />} hue="#eb6834" label="Stuck 3+ days" value={all.filter((p) => p.stage !== "live" && p.hours >= 72).length} t={all.some((p) => p.stage !== "live" && p.hours >= 72) ? "bad" : undefined} />
        <Kpi icon={<MailWarning />} hue="#e5484d" label="Not joined after a week" value={all.filter((p) => p.stage === "invite" && p.hours >= 168).length} note="Time for a personal reach-out" t={all.some((p) => p.stage === "invite" && p.hours >= 168) ? "bad" : undefined} />
        <Kpi icon={<UserCheck />} hue="#2a78d6" label="Waiting on you" value={due.length} note="Decisions: approvals and calls" t={due.length ? "warn" : undefined} />
      </div>
      <Segmented label="View" value={view} onChange={setView} options={[{ id: "outbox", label: "Today" }, { id: "clients", label: "By client" }, { id: "questions", label: "Common questions" }, { id: "messages", label: "Messages" }]} />
      {view === "outbox" && <Outbox clients={s.clients} />}
      {view === "clients" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((c) => (
            <Section key={c.id} title={c.name} sub={`${people(c, s.today).filter((p) => p.stage === "live").length} of ${c.seats.length} live`} right={<span className="flex items-center gap-2">{s.autopilot[c.id] === false && <Pill t="muted">Autopilot off</Pill>}<Link href={`/clients/${c.id}?tab=autopilot`} className="text-sm font-medium text-[var(--bronze)] hover:underline">Open</Link></span>}>
              <Funnel clients={[c]} />
            </Section>
          ))}
          {active.length === 0 && <p className="text-sm text-[var(--text-muted)]">Everyone is live.</p>}
        </div>
      )}
      {view === "questions" && <CommonQuestions />}
      {view === "messages" && <SequenceEditor />}
    </>
  )
}

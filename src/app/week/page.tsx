"use client"

import { useState } from "react"
import { ActionRow } from "@/components/action-row"
import { Kpi, Section, Segmented, Shown } from "@/components/bits"
import { addDays, fmt, fmtLong, weekStart } from "@/lib/dates"
import { openActions, assignee } from "@/lib/engine"
import { useStore } from "@/lib/store"

export default function Week() {
  const { s } = useStore()
  const t = s.today
  const mon = weekStart(t)
  const sun = addDays(mon, 6)
  const [owner, setOwner] = useState("Everyone")
  const owners = ["Everyone", ...s.team.map((m) => m.name)]

  const all = s.clients.flatMap((c) => openActions(s, c)).filter((a) => owner === "Everyone" || assignee(s, a) === owner)
  const inWeek = all.filter((a) => a.due <= sun)
  const later = all.filter((a) => a.due > sun)
  const overdue = inWeek.filter((a) => a.due < t)
  const doneThisWeek = Object.entries(s.done).filter(([, d]) => d >= mon && d <= sun).length
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">This week</h1>
          <p className="text-sm text-[var(--text-secondary)]">{fmtLong(mon)} to {fmtLong(sun)}. Every action across every client, generated from stage, requirements, alerts and the calendar.</p>
        </div>
        <Segmented label="Assigned to" value={owner} onChange={setOwner} options={owners.map((o) => ({ id: o, label: o }))} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="To do this week" value={inWeek.length} note={`${inWeek.filter((a) => a.severity === "Critical").length} critical`} />
        <Kpi label="Overdue" value={overdue.length} t={overdue.length ? "bad" : undefined} note="Carried from earlier days" />
        <Kpi label="Done this week" value={doneThisWeek} note="Ticked off in Studio" />
        <Kpi label="Coming next week" value={later.length} note="Already scheduled" />
      </div>

      {overdue.length > 0 && (
        <Section title="Overdue" sub="Do these first" className="border-[color-mix(in_oklch,var(--status-critical),white_60%)]">
          {overdue.map((a) => <ActionRow key={a.key} a={a} showClient />)}
        </Section>
      )}
      {days.map((d) => {
        const list = inWeek.filter((a) => a.due === d && a.due >= t)
        if (d < t) return null
        return (
          <Section key={d} title={d === t ? `Today · ${fmtLong(d)}` : fmtLong(d)} sub={list.length ? `${list.length} actions` : "Nothing due"}>
            {list.map((a) => <ActionRow key={a.key} a={a} showClient />)}
          </Section>
        )
      })}
      {later.length > 0 && (
        <Section title="Next week and later" sub={`From ${fmt(addDays(sun, 1))}`}>
          {later.slice(0, 8).map((a) => <ActionRow key={a.key} a={a} showClient />)}
          <Shown n={8} of={later.length} hint="Open a client to see all of theirs." />
        </Section>
      )}
    </>
  )
}

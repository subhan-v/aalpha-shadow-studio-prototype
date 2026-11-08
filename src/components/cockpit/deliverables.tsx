"use client"

import Link from "next/link"
import { Pill, Section } from "@/components/bits"
import { fmt } from "@/lib/dates"
import { deliverables } from "@/lib/engine"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"

const T = { done: ["good", "Done"], draft: ["info", "In progress"], due: ["warn", "Due this week"], overdue: ["bad", "Overdue"], upcoming: ["muted", "Upcoming"] } as const

/** Everything the founder offer promises, on one calendar, with its real state. */
export function DeliverablesTab({ c }: { c: Client }) {
  const { s } = useStore()
  const list = deliverables(c, s.today)
  if (!list.length) return <Section title="Deliverables" sub="Starts at kickoff"><p className="py-4 text-sm text-[var(--text-muted)]">The calendar fills in once the kickoff is held.</p></Section>
  const done = list.filter((d) => d.status === "done").length
  return (
    <Section title="Deliverables" sub={`${done} of ${list.length} done · updated from the work itself, never ticked by hand`}>
      <div className="flex flex-col">
        {list.map((d) => (
          <div key={d.name} className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-center gap-3 border-t py-3 first:border-t-0 sm:grid-cols-[90px_minmax(0,1fr)_200px_auto]">
            <span className="font-mono text-xs text-[var(--text-muted)]">{fmt(d.due)}</span>
            <span className="text-sm font-medium">{d.name}</span>
            <span className="hidden text-xs text-[var(--text-secondary)] sm:block">{d.detail}</span>
            <Link href={`/clients/${c.id}?tab=${d.tab}`} className="justify-self-end"><Pill t={T[d.status][0]}>{T[d.status][1]}</Pill></Link>
          </div>
        ))}
      </div>
    </Section>
  )
}

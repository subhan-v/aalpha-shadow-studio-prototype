"use client"

import Link from "next/link"
import { SevPill } from "@/components/bits"
import { PersonPicker } from "@/components/person-picker"
import { Button, buttonVariants } from "@/components/ui/button"
import { fmt } from "@/lib/dates"
import { assignee } from "@/lib/engine"
import { useStore } from "@/lib/store"
import type { Action } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ActionRow({ a, showClient }: { a: Action; showClient?: boolean }) {
  const { s, runAction, assignAction } = useStore()
  const overdue = a.due < s.today
  const who = assignee(s, a)
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-t py-3 first:border-t-0 lg:grid-cols-[84px_minmax(0,1fr)_auto_auto]">
      <SevPill s={a.severity} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium leading-snug">
          {showClient && <Link href={`/clients/${a.clientId}`} className="mr-1.5 text-[var(--seq-800)] hover:underline">{a.clientName}</Link>}
          {a.title}
        </span>
        <span className="text-xs leading-snug text-[var(--text-muted)]">{a.why}</span>
      </div>
      <div className="col-span-2 flex items-center justify-end gap-3 lg:col-span-1">
        <span className={cn("whitespace-nowrap font-mono text-xs", overdue ? "font-medium text-[var(--delta-bad)]" : "text-[var(--text-muted)]")}>
          {overdue ? `Overdue ${fmt(a.due)}` : a.due === s.today ? "Today" : fmt(a.due)}
        </span>
        <PersonPicker label={`Assign: ${a.title}`} value={who} onChange={(v) => assignAction(a.key, v)} className="min-w-36" />
      </div>
      <div className="col-span-2 flex justify-end gap-1.5 lg:col-span-1">
        {a.linear && <Button variant="ghost" size="sm" className="font-mono" title="Opens the task in Linear (not wired in the prototype)">{a.linear}</Button>}
        {a.tab ? (
          <Link href={`/clients/${a.clientId}?tab=${a.tab}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-[10px]")}>{a.cta}</Link>
        ) : (
          <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => runAction(a.clientId, a.key)}>{a.cta}</Button>
        )}
      </div>
    </div>
  )
}

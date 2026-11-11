"use client"

// The renewal card on a client's Overview. Anyone on the client can open the renewal and mark the
// proposal sent; only an Admin records the outcome and the price. Specialists never see prices.

import { useState } from "react"
import { CalendarClock, Check, RotateCcw, X } from "lucide-react"
import { Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { canEdit, canMoney } from "@/lib/access"
import { diffDays, fmt } from "@/lib/dates"
import { dateOfDay, dayN } from "@/lib/engine"
import { recurringPrice } from "@/lib/finance"
import { CHURN_REASONS, day91, lose, openRenewal, overdueDays, renew, renewalStage, reopen, sendProposal } from "@/lib/renewal"
import { offboardDeletionDue } from "@/lib/retention"
import { useStore } from "@/lib/store"
import type { ChurnReason, Client } from "@/lib/types"

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`
const TONE = { "Not open": "muted", "Due to open": "warn", Open: "info", "Proposal sent": "info", Renewed: "good", Lost: "bad" } as const

export function RenewalCard({ c }: { c: Client }) {
  const { s, update } = useStore()
  const t = s.today
  const n = dayN(c, t)
  const stage = renewalStage(c, t)
  const r = c.renewal
  const money = canMoney(s)
  const edit = canEdit(s)
  const [price, setPrice] = useState(String(r?.proposedPrice ?? recurringPrice(s, c)))
  const [mode, setMode] = useState<"renew" | "lose" | null>(null)
  const [reason, setReason] = useState<ChurnReason>(CHURN_REASONS[0])
  const [note, setNote] = useState("")
  if (n === null) return null
  const d90 = dateOfDay(c, 90)!
  const late = overdueDays(c, t)
  const left = diffDays(d90, t)
  const decided = stage === "Renewed" || stage === "Lost"

  const when = stage === "Renewed" ? `Monthly plan ${r!.startsOn! > t ? "from" : "since"} ${fmt(r!.startsOn!)}${money ? ` at ${usd(r!.price!)} a month` : ""}`
    : stage === "Lost" ? `Ended at day 90 · ${r!.reason}${r!.note ? `: ${r!.note}` : ""}`
    : late ? `Day 90 was ${fmt(d90)}. Undecided for ${late} ${late === 1 ? "day" : "days"}, so nothing is billing.`
    : stage === "Not open" ? `Opens on day 75 (${fmt(dateOfDay(c, 75)!)}). Day 90 is ${fmt(d90)}.`
    : `Day 90 is ${fmt(d90)}, in ${left} ${left === 1 ? "day" : "days"}. The monthly plan starts only once this is recorded.`

  return (
    <Section title="Renewal" sub={when} right={<Pill t={late ? "bad" : TONE[stage]}>{late ? "Overdue" : stage}</Pill>}>
      <ol className="mb-3 grid grid-cols-3 gap-2 text-xs">
        {([["Opened", r?.openedAt], ["Proposal sent", r?.proposedAt], [stage === "Lost" ? "Lost" : "Renewed", r?.decidedAt]] as const).map(([k, d]) => (
          <li key={k} className={`flex flex-col rounded-lg px-2 py-1.5 ${d ? "bg-[var(--seq-100)] text-[var(--seq-900)]" : "bg-[var(--surface-2)] text-[var(--text-muted)]"}`}><span>{k}</span><span className="font-semibold tabular-nums">{d ? fmt(d) : "Not yet"}</span></li>
        ))}
      </ol>
      {edit && (
        <div className="flex flex-wrap items-end gap-2">
          {stage === "Due to open" && <Button size="sm" className="rounded-[10px]" onClick={() => update(c.id, (x, d) => openRenewal(x, d, s.me))}><CalendarClock />Open renewal</Button>}
          {stage === "Open" && (money
            ? <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); update(c.id, (x, d) => sendProposal(x, d, s.me, Number(price) || null)) }}>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Proposed price, $ a month<Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-32 rounded-[10px]" /></label>
                <Button type="submit" size="sm" variant="outline" className="h-9 rounded-[10px]">Mark proposal sent</Button>
              </form>
            : <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => update(c.id, (x, d) => sendProposal(x, d, s.me, null))}>Mark proposal sent</Button>)}
          {!decided && stage !== "Not open" && stage !== "Due to open" && money && <>
            <Button size="sm" className="rounded-[10px]" onClick={() => setMode(mode === "renew" ? null : "renew")}><Check />Renewed</Button>
            <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setMode(mode === "lose" ? null : "lose")}><X />Lost</Button>
          </>}
          {decided && money && !c.offboardedAt && <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => { if (window.confirm("Reopen this renewal? Billing after day 90 stops until it is decided again.")) update(c.id, (x, d) => reopen(x, d, s.me)) }}><RotateCcw />Reopen</Button>}
          {!decided && !money && stage !== "Not open" && stage !== "Due to open" && <span className="text-xs text-[var(--text-muted)]">An Admin records the outcome.</span>}
        </div>
      )}
      {mode === "renew" && (
        <form className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border p-3" onSubmit={(e) => { e.preventDefault(); const v = Number(price); if (!v) return; update(c.id, (x, d) => renew(x, d, s.me, v)); setMode(null) }}>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Agreed price, $ a month<Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-32 rounded-[10px]" /></label>
          <Button type="submit" size="sm" className="h-9 rounded-[10px]">Record renewal</Button>
          <span className="w-full text-xs text-[var(--text-muted)]">The monthly plan starts {late ? "today" : `on ${fmt(day91(c)!)}`}, and billing with it.</span>
        </form>
      )}
      {mode === "lose" && (
        <form className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border p-3" onSubmit={(e) => { e.preventDefault(); update(c.id, (x, d) => lose(x, d, s.me, reason, note.trim())); setMode(null); setNote("") }}>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Main reason
            <select value={reason} onChange={(e) => setReason(e.target.value as ChurnReason)} className="h-9 rounded-[10px] border bg-card px-2 text-sm text-[var(--text-primary)]">{CHURN_REASONS.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What they said (optional)" aria-label="What they said" className="h-9 min-w-48 flex-1 rounded-[10px] text-sm" />
          <Button type="submit" size="sm" variant="outline" className="h-9 rounded-[10px]">Record loss</Button>
          <span className="w-full text-xs text-[var(--text-muted)]">Nothing bills after day 90. The client moves to Lost and offboarding becomes the next action.</span>
        </form>
      )}
      {stage === "Lost" && <p className="mt-2 text-xs text-[var(--text-muted)]">{c.offboardedAt ? `Offboarded ${fmt(c.offboardedAt)}. ${c.dataDeletedAt ? `All data deleted ${fmt(c.dataDeletedAt)}, owner told.` : `All data due to be deleted by ${fmt(offboardDeletionDue(c)!)}.`}` : "Offboarding is the next action."}</p>}
    </Section>
  )
}

"use client"

// Studio > client > Settings > Subscription (Aalpha admins only). Change the plan and price,
// add a discount or a one-off credit, pause, change the billing day, or cancel at period end.
// Every change is logged with who and when; in the real build each one is sent to Stripe.
// Below: six months of revenue against cost for this client, and the contract and consent
// records (the signed files stay in the e-signature tool; Studio keeps the facts and a link).

import { useState } from "react"
import { FileSignature, History, PauseCircle, Percent, PlayCircle, ReceiptText, ShieldCheck, XCircle } from "lucide-react"
import { Kpi, Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addDays, fmt } from "@/lib/dates"
import { billing, costWeeks, listFor, revenueMo } from "@/lib/finance"
import { useStore } from "@/lib/store"
import { CHURN_REASONS, phase } from "@/lib/renewal"
import { hasConsent } from "@/lib/setup"
import type { Client, SubSettings, ChurnReason } from "@/lib/types"
import { cn } from "@/lib/utils"

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`
const STATUS: Record<string, ["good" | "bad" | "warn" | "muted", string]> = { active: ["good", "Active"], past_due: ["bad", "Past due"], paused: ["warn", "Paused"], canceling: ["warn", "Cancels at period end"], canceled: ["muted", "Cancelled"], on_hold: ["bad", "Renewal undecided"], ended: ["muted", "Ended at day 90"] }

export function SubscriptionTab({ c }: { c: Client }) {
  const { s, update } = useStore()
  const t = s.today
  const b = billing(s, c)
  const sub = c.sub ?? {}
  const [price, setPrice] = useState(String(c.price ?? listFor(s, c, t)))
  const [pct, setPct] = useState("10")
  const [months, setMonths] = useState("3")
  const [credit, setCredit] = useState("500")
  const [note, setNote] = useState("")
  const [reason, setReason] = useState("")
  const [churnWhy, setChurnWhy] = useState<ChurnReason>(CHURN_REASONS[0])
  const [pauseWhy, setPauseWhy] = useState("")
  const change = (patch: Partial<SubSettings> | null, text: string, clientPatch: Partial<Client> = {}) => update(c.id, (x, d) => ({
    ...x, ...clientPatch,
    sub: { ...(x.sub ?? {}), ...(patch ?? {}), history: [{ at: d, by: s.me, text }, ...(x.sub?.history ?? [])] },
    log: [{ date: d, text: `Subscription: ${text} (${s.me}).` }, ...x.log],
  }))
  const recurring = phase(c, t) === "recurring"
  const st = b.sub ? STATUS[b.sub.status] : null

  // Six months of revenue against cost: 4-week blocks, newest last.
  const weeks = costWeeks(s, c, t, 24)
  const blocks = Array.from({ length: 6 }, (_, i) => {
    const w = weeks.slice(i * 4, i * 4 + 4)
    const end = w[w.length - 1].end
    return { end, revenue: w.reduce((x, y) => x + y.revenue, 0), cost: w.reduce((x, y) => x + y.total, 0) }
  }).filter((x) => x.revenue > 0 || x.cost > 0)
  const max = Math.max(1, ...blocks.flatMap((x) => [x.revenue, x.cost]))
  const lifeRev = b.invoices.filter((i) => i.status === "paid").reduce((x, i) => x + i.amount, 0)
  const lifeCost = weeks.reduce((x, y) => x + y.total, 0)
  const consented = c.seats.filter((x) => x.consent).length
  const current = c.seats.filter((x) => hasConsent(c, x)).length

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Kpi label="Bills a month" value={usd(revenueMo(s, c, t))} note={sub.discount ? `${usd(listFor(s, c, t))} before ${sub.discount.pct}% off` : b.sub?.plan ?? "Not started"} />
        <Kpi label="Status" value={st ? st[1] : "Not started"} t={st && st[0] === "bad" ? "bad" : st && st[0] === "warn" ? "warn" : undefined} note={b.sub?.renews ? `Renews ${fmt(b.sub.renews)}` : ""} />
        <Kpi label="Collected so far" value={usd(lifeRev)} note={`${b.invoices.filter((i) => i.status === "paid").length} paid invoices shown`} />
        <Kpi label="Cost to serve, 24 weeks" value={usd(lifeCost)} note={lifeRev ? `${Math.round(((lifeRev - lifeCost) / lifeRev) * 100)}% margin on what's collected` : ""} />
      </div>

      <Section title="Manage the subscription" sub="Aalpha admins only. Each change is logged and, in the real build, sent to Stripe.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-2xl border p-4">
            <span className="flex items-center gap-2 text-sm font-semibold"><ReceiptText className="size-4" />Plan and price</span>
            {!recurring ? (
              <div className="flex flex-wrap gap-1.5">
                {(["upfront", "monthly"] as const).map((p) => <button key={p} aria-pressed={c.plan === p} onClick={() => c.plan !== p && change(null, `Plan changed to ${p === "upfront" ? "90 days paid upfront" : "90 days monthly"}`, { plan: p })} className={cn("h-8 rounded-[10px] border px-3 text-sm", c.plan === p ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "")}>{p === "upfront" ? "90 days, upfront" : "90 days, monthly"}</button>)}
              </div>
            ) : <span className="text-sm text-[var(--text-secondary)]">Recurring plan</span>}
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number(price); if (!v) return; change(null, `Recurring price set to ${usd(v)} a month`, { price: v }) }}>
              <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Recurring price, $ a month<Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-36 rounded-[10px]" /></label>
              <Button type="submit" size="sm" variant="outline" className="h-9 rounded-[10px]">Set price</Button>
            </form>
            <span className="text-xs text-[var(--text-muted)]">{recurring ? "Takes effect on the next invoice." : "Used as the renewal proposal. The monthly plan starts when the renewal is recorded on the Overview."}</span>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border p-4">
            <span className="flex items-center gap-2 text-sm font-semibold"><Percent className="size-4" />Discount or credit</span>
            {sub.discount ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">{sub.discount.pct}% off{sub.discount.until ? ` until ${fmt(sub.discount.until)}` : ""}<span className="text-xs text-[var(--text-muted)]">{sub.discount.note}</span><Button size="xs" variant="ghost" onClick={() => change({ discount: null }, "Discount removed")}>Remove</Button></span>
            ) : (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const p = Number(pct), m = Number(months); if (!p) return; change({ discount: { pct: p, from: t, until: m ? addDays(t, 30 * m) : null, note: note || "No note" } }, `${p}% discount${m ? ` for ${m} months` : ""}${note ? `: ${note}` : ""}`); setNote("") }}>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">% off<Input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className="h-9 w-20 rounded-[10px]" /></label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Months (0 = ongoing)<Input type="number" min={0} value={months} onChange={(e) => setMonths(e.target.value)} className="h-9 w-24 rounded-[10px]" /></label>
                <Button type="submit" size="sm" variant="outline" className="h-9 rounded-[10px]">Add discount</Button>
              </form>
            )}
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number(credit); if (!v) return; change({ credits: [{ amount: v, at: t, note: note || "Goodwill credit" }, ...(sub.credits ?? [])] }, `${usd(v)} credit${note ? `: ${note}` : ""}`); setNote("") }}>
              <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">One-off credit, $<Input type="number" min={1} value={credit} onChange={(e) => setCredit(e.target.value)} className="h-9 w-28 rounded-[10px]" /></label>
              <Button type="submit" size="sm" variant="outline" className="h-9 rounded-[10px]">Add credit</Button>
            </form>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why (shows in the history)" aria-label="Reason for the discount or credit" className="h-9 rounded-[10px] text-sm" />
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border p-4">
            <span className="flex items-center gap-2 text-sm font-semibold"><PauseCircle className="size-4" />Pause and billing day</span>
            {sub.paused && (!sub.paused.until || t < sub.paused.until) ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">Paused from {fmt(sub.paused.from)}{sub.paused.until ? ` to ${fmt(sub.paused.until)}` : ""}<Button size="xs" variant="outline" onClick={() => change({ paused: null }, "Billing resumed")}><PlayCircle />Resume</Button></span>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Input value={pauseWhy} onChange={(e) => setPauseWhy(e.target.value)} placeholder="Why (optional)" aria-label="Pause reason" className="h-9 min-w-40 flex-1 rounded-[10px] text-sm" />
                {[1, 2].map((m) => <Button key={m} size="sm" variant="outline" className="h-9 rounded-[10px]" onClick={() => { change({ paused: { from: t, until: addDays(t, 30 * m), reason: pauseWhy.trim() || "Client asked" } }, `Billing paused for ${m} month${m > 1 ? "s" : ""}${pauseWhy.trim() ? `: ${pauseWhy.trim()}` : ""}`); setPauseWhy("") }}>Pause {m} month{m > 1 ? "s" : ""}</Button>)}
              </div>
            )}
            <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">Bills on day
              <Input key={sub.billingDay ?? "d"} type="number" min={1} max={28} defaultValue={sub.billingDay ?? Math.min(28, Number(c.signedDate.slice(8, 10)))} onBlur={(e) => { const v = Math.min(28, Math.max(1, Number(e.target.value))); if (v !== (sub.billingDay ?? Math.min(28, Number(c.signedDate.slice(8, 10))))) change({ billingDay: v }, `Billing day changed to the ${v}${v === 1 || v === 21 ? "st" : v === 2 || v === 22 ? "nd" : v === 3 || v === 23 ? "rd" : "th"}`) }} className="h-8 w-20 rounded-[10px]" />
              of each month
            </label>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border p-4">
            <span className="flex items-center gap-2 text-sm font-semibold"><XCircle className="size-4" />Cancel</span>
            {sub.cancelAt ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">Cancels {fmt(sub.cancelAt)} · {sub.cancelReason ?? "Other"}{sub.cancelNote ? `: ${sub.cancelNote}` : ""}<Button size="xs" variant="outline" onClick={() => change({ cancelAt: null, cancelReason: null, cancelNote: null }, "Cancellation reversed")}>Keep them</Button></span>
            ) : (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!b.sub?.renews) return; const why = reason.trim(); change({ cancelAt: b.sub.renews, cancelReason: churnWhy, cancelNote: why || null }, `Set to cancel at period end (${fmt(b.sub.renews!)}): ${churnWhy}${why ? `. ${why}` : ""}`); setReason("") }}>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Main reason
                  <select value={churnWhy} onChange={(e) => setChurnWhy(e.target.value as ChurnReason)} aria-label="Cancel reason" className="h-9 rounded-[10px] border bg-card px-2 text-sm text-[var(--text-primary)]">{CHURN_REASONS.map((x) => <option key={x}>{x}</option>)}</select>
                </label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What they said (optional)" aria-label="What they said" className="h-9 min-w-48 flex-1 rounded-[10px] text-sm" />
                <Button type="submit" size="sm" variant="outline" className="h-9 rounded-[10px]" disabled={!b.sub?.renews}>Cancel at period end</Button>
              </form>
            )}
            <span className="text-xs text-[var(--text-muted)]">They keep access until the end of the paid period. The same seven reasons as a lost renewal, so Retention reads all churn the same way.</span>
          </div>
        </div>
      </Section>

      <Section title="Revenue against cost" sub="Every four weeks for the last six months. Cost is the cost to serve; server and team costs come later.">
        <div className="flex flex-col gap-2">
          {blocks.map((x) => (
            <div key={x.end} className="grid grid-cols-[72px_minmax(0,1fr)_110px] items-center gap-3 text-sm">
              <span className="text-xs text-[var(--text-muted)]">to {fmt(x.end)}</span>
              <span className="flex flex-col gap-[2px]" title={`Revenue ${usd(x.revenue)}, cost ${usd(x.cost)}`}>
                <span className="h-2.5 rounded-r-[4px]" style={{ width: `${(x.revenue / max) * 100}%`, background: "#2a78d6" }} />
                <span className="h-2.5 rounded-r-[4px]" style={{ width: `${Math.max(0.5, (x.cost / max) * 100)}%`, background: "#eb6834" }} />
              </span>
              <span className="text-right text-xs tabular-nums"><b className="font-semibold">{usd(x.revenue - x.cost)}</b> left</span>
            </div>
          ))}
          <div className="flex gap-4 text-xs text-[var(--text-secondary)]"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#2a78d6]" />Revenue</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#eb6834]" />Cost to serve</span></div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Change history" sub="Who changed what, and when">
          {(sub.history ?? []).length === 0 && <p className="text-sm text-[var(--text-muted)]">No changes yet.</p>}
          {(sub.history ?? []).map((h, i) => <div key={i} className="flex gap-2 border-t py-2 text-sm first:border-t-0"><History className="mt-0.5 size-3.5 shrink-0 text-[var(--text-muted)]" /><span className="flex-1">{h.text}</span><span className="shrink-0 text-xs text-[var(--text-muted)]">{h.by} · {fmt(h.at)}</span></div>)}
        </Section>
        <Section title="Contract and consent" sub="The signed files stay in the e-signature tool. Studio keeps the facts and a link.">
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-start gap-2.5"><FileSignature className="mt-0.5 size-4 text-[var(--text-muted)]" />
              {c.contract ? <span className="flex flex-col"><span className="font-medium">{c.contract.version}</span><span className="text-xs text-[var(--text-secondary)]">Signed by {c.contract.signer} on {fmt(c.contract.signed)} · {c.contract.term}</span><a href={c.contract.url} className="text-xs text-[var(--bronze)] hover:underline">Open the signed copy</a></span> : <span className="text-[var(--text-muted)]">No contract on file</span>}
            </div>
            <div className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 size-4 text-[var(--text-muted)]" />
              <span className="flex flex-col"><span className="font-medium">{current} of {c.seats.length} agreed to {c.consentVersion ?? "the consent form"}{consented > current ? ` · ${consented - current} on an older version` : ""}</span><span className="text-xs text-[var(--text-secondary)]">Recorded per person with the date and version. Nobody records until they have consented.</span>
                <Button size="xs" variant="outline" className="mt-1.5 w-fit" onClick={() => { const [maj, min] = (c.consentVersion ?? "v1.0").replace(/^.*v/, "").split(".").map(Number); const v = `Consent form v${maj || 1}.${(min || 0) + 1}`; if (window.confirm(`Publish ${v}? Everyone at ${c.name} is asked to agree again.`)) update(c.id, (x, d) => ({ ...x, consentVersion: v, log: [{ date: d, text: `${v} published. Everyone is asked to agree again.` }, ...x.log] })) }}>Publish a new version</Button>
                {consented < c.seats.length && <span className="mt-1 flex flex-wrap gap-1">{c.seats.filter((x) => !x.consent).map((x) => <Pill key={x.id} t="warn">{x.name}</Pill>)}</span>}
              </span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

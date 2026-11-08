"use client"

// Business profile: what we ask the owner at kickoff so the numbers match how the agency
// makes money. Owner and Aalpha only. It feeds revenue per pod, the value of founder time
// and the split of leadership time between this company and other work.

import { Plus, Trash2 } from "lucide-react"
import { Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import type { BusinessProfile, Client } from "@/lib/types"
import { APP } from "@/lib/flags"

const EMPTY: BusinessProfile = { offer: "", pricing: "", pods: [], execRate: 0, ownerValue: 0, targetMargin: 0, otherCompanies: [] }
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

export function BusinessProfileForm({ c }: { c: Client }) {
  const { update } = useStore()
  const b = c.business ?? EMPTY
  const set = (patch: Partial<BusinessProfile>) => update(c.id, (x) => ({ ...x, business: { ...(x.business ?? EMPTY), ...patch } }))
  const pod = (i: number, patch: Partial<BusinessProfile["pods"][number]>) => set({ pods: b.pods.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const revenue = b.pods.reduce((n, p) => n + p.revenueMo, 0)
  const people = b.pods.reduce((n, p) => n + p.people, 0)
  return (
    <div className="flex flex-col gap-4">
      <Section title="Your business" sub="Collected at kickoff. Only you and Aalpha see this.">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">What you sell<Input value={b.offer} onChange={(e) => set({ offer: e.target.value })} placeholder="Paid media retainers for DTC brands" className="h-10 rounded-[10px] text-sm text-[var(--text-primary)]" /></label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">How you price it<Input value={b.pricing} onChange={(e) => set({ pricing: e.target.value })} placeholder="$6k to $15k a month per client" className="h-10 rounded-[10px] text-sm text-[var(--text-primary)]" /></label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">Your loaded rate, $ an hour (from payroll)<Input type="number" min={0} value={b.execRate} onChange={(e) => set({ execRate: Number(e.target.value) })} className="h-10 rounded-[10px] text-sm text-[var(--text-primary)]" /></label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">What an hour of your time is worth to the business<Input type="number" min={0} value={b.ownerValue} onChange={(e) => set({ ownerValue: Number(e.target.value) })} className="h-10 rounded-[10px] text-sm text-[var(--text-primary)]" /></label>
        </div>
      </Section>

      <Section title="Team pods" sub="Each pod's people, clients and monthly revenue" right={<Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => set({ pods: [...b.pods, { name: `Pod ${b.pods.length + 1}`, people: 5, clients: 5, revenueMo: 50000 }] })}><Plus />Add pod</Button>}>
        <div className="overflow-x-auto">
          <div className="flex min-w-[640px] flex-col gap-2">
            <div className="grid grid-cols-[minmax(0,2fr)_80px_80px_120px_110px_32px] gap-2 text-xs text-[var(--text-muted)]"><span>Pod</span><span>People</span><span>Clients</span><span>Revenue / mo</span><span className="text-right">Per person</span><span /></div>
            {b.pods.map((p, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,2fr)_80px_80px_120px_110px_32px] items-center gap-2">
                <Input aria-label="Pod name" value={p.name} onChange={(e) => pod(i, { name: e.target.value })} className="h-9 rounded-[10px] text-sm" />
                <Input aria-label="People" type="number" min={1} value={p.people} onChange={(e) => pod(i, { people: Math.max(1, Number(e.target.value)) })} className="h-9 rounded-[10px] text-sm" />
                <Input aria-label="Clients" type="number" min={0} value={p.clients} onChange={(e) => pod(i, { clients: Number(e.target.value) })} className="h-9 rounded-[10px] text-sm" />
                <Input aria-label="Revenue a month" type="number" min={0} value={p.revenueMo} onChange={(e) => pod(i, { revenueMo: Number(e.target.value) })} className="h-9 rounded-[10px] text-sm" />
                <span className="text-right text-sm font-semibold tabular-nums">{usd(p.revenueMo / p.people)}</span>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => set({ pods: b.pods.filter((_, j) => j !== i) })}><Trash2 /></Button>
              </div>
            ))}
            {b.pods.length > 0 && <div className="grid grid-cols-[minmax(0,2fr)_80px_80px_120px_110px_32px] gap-2 border-t pt-2 text-sm font-semibold"><span>Total</span><span className="tabular-nums">{people}</span><span className="tabular-nums">{b.pods.reduce((n, p) => n + p.clients, 0)}</span><span className="tabular-nums">{usd(revenue)}</span><span className="text-right tabular-nums">{people ? usd(revenue / people) : "–"}</span><span /></div>}
          </div>
        </div>
      </Section>

      <Section title="Other companies leadership works on" sub={`Tag their Slack workspaces, sites and repos. ${APP} then splits leadership time by company and shows only the totals.`}>
        <div className="flex flex-col gap-3">
          {b.otherCompanies.map((o, i) => (
            <div key={i} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_32px] md:items-center">
              <Input aria-label="Company" value={o.name} onChange={(e) => set({ otherCompanies: b.otherCompanies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="h-9 rounded-[10px] text-sm" />
              <Input aria-label="Sources, comma separated" value={o.sources.join(", ")} onChange={(e) => set({ otherCompanies: b.otherCompanies.map((x, j) => (j === i ? { ...x, sources: e.target.value.split(",").map((y) => y.trim()).filter(Boolean) } : x)) })} className="h-9 rounded-[10px] font-mono text-xs" />
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${o.name}`} onClick={() => set({ otherCompanies: b.otherCompanies.filter((_, j) => j !== i) })}><Trash2 /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-fit rounded-[10px]" onClick={() => set({ otherCompanies: [...b.otherCompanies, { name: "Other company", sources: [] }] })}><Plus />Add a company</Button>
        </div>
      </Section>

      <Section title="What this changes" sub="Where these answers are used">
        <ul className="grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
          <li>Revenue per person for each pod, worked out above.</li>
          <li>{b.ownerValue ? `Founder time on work that could be handed off, priced at $${b.ownerValue}/h, in the Executive report.` : "Founder time on work that could be handed off, priced at your own value, in the Executive report."}</li>
          <li>The split of leadership time between this company and other work, in the Executive report.</li>
        </ul>
      </Section>
    </div>
  )
}

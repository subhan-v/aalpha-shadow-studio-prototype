"use client"

// Organization: how the agency is set up, which decides what a "team" is everywhere in the
// app. By function (the default), by pod, or hybrid (pods for client delivery, function teams
// for shared services). Owner and Aalpha only.

import { Section } from "@/components/bits"
import { useStore } from "@/lib/store"
import { funcOf, FUNCTIONS, SHARED, teamsOf } from "@/lib/teams"
import type { Client } from "@/lib/types"
import { cn } from "@/lib/utils"

const MODES: { id: "function" | "pod" | "hybrid"; name: string; body: string }[] = [
  { id: "function", name: "By function", body: "Teams are Paid media, Creative, Client delivery and so on. Each person has one home team." },
  { id: "pod", name: "By pod", body: "Teams are pods that own a set of clients. The pod lead manages it. Everyone keeps a function, so work also shows by function across pods." },
  { id: "hybrid", name: "Hybrid", body: `Pods for client delivery, function teams for shared services (${SHARED.join(", ")}).` },
]

export function OrgSettings({ c }: { c: Client }) {
  const { update } = useStore()
  const org = c.org ?? "function"
  const set = (v: typeof org) => update(c.id, (x, t) => ({ ...x, org: v, log: [{ date: t, text: `Organization set to ${MODES.find((m) => m.id === v)!.name.toLowerCase()}.` }, ...x.log] }))
  const teams = teamsOf(c)
  const name = (id?: string) => c.seats.find((s) => s.id === id)?.name ?? "not set"
  return (
    <div className="flex flex-col gap-4">
      <Section title="How is your agency organized?" sub="This decides what a team is: who follows up with whom, what managers see, and how work is grouped.">
        <div role="radiogroup" aria-label="Organization" className="grid gap-3 md:grid-cols-3">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={org === m.id} disabled={m.id !== "function" && !c.pods?.length} onClick={() => set(m.id)}
              className={cn("flex flex-col gap-1.5 rounded-2xl border p-4 text-left disabled:opacity-50", org === m.id ? "border-[var(--graphite)] bg-[var(--seq-100)]" : "hover:bg-[var(--surface-2)]")}>
              <span className="flex items-center gap-2 font-semibold"><span className={cn("size-3.5 rounded-full border-2", org === m.id ? "border-[var(--graphite)] bg-[var(--graphite)]" : "border-[var(--text-muted)]")} />{m.name}{m.id === "function" && <span className="text-xs font-normal text-[var(--text-muted)]">default</span>}</span>
              <span className="text-sm text-[var(--text-secondary)]">{m.body}</span>
            </button>
          ))}
        </div>
        {!c.pods?.length && <p className="mt-3 text-xs text-[var(--text-muted)]">Pods are set up with Aalpha at kickoff. Ask us to add yours to switch.</p>}
      </Section>

      <Section title="Your teams now" sub="Every person has exactly one home team, so no hours are counted twice">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <div key={t.name} className="flex flex-col gap-1 rounded-2xl border p-4 text-sm">
              <span className="flex items-center justify-between gap-2"><span className="font-semibold">{t.name}</span><span className="text-xs text-[var(--text-muted)]">{t.kind === "pod" ? "Pod" : "Function"} · {t.seats.length}</span></span>
              <span className="text-xs text-[var(--text-secondary)]">Lead: {t.lead?.name ?? "not set"}</span>
              {t.seats.length < 3 && <span className="text-xs text-[var(--watch-fg)]">Under 3 people: rolls up in team views</span>}
            </div>
          ))}
        </div>
      </Section>

      {c.pods && c.pods.length > 0 && (
        <Section title="Pods and the clients they own" sub="Clients are tags from Slack channels and the CRM. Each one maps to the pod that owns it.">
          <div className="flex flex-col gap-2">
            {c.pods.map((p) => (
              <div key={p.name} className="grid gap-1 rounded-xl border p-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] md:items-center">
                <span className="font-medium">{p.name}</span>
                <span className="text-[var(--text-secondary)]">Lead: {name(p.lead)}</span>
                <span className="flex flex-wrap gap-1.5">{p.clients.map((x) => <span key={x} className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs">{x}</span>)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Function heads" sub="In pods or hybrid, a function head sees their function across every pod">
        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {FUNCTIONS.map((f) => <div key={f} className="flex justify-between gap-2 rounded-xl border px-3 py-2"><span>{f}</span><span className="text-[var(--text-secondary)]">{name(c.funcHeads?.[f])} · {c.seats.filter((s) => funcOf(s) === f).length}</span></div>)}
        </div>
      </Section>
    </div>
  )
}

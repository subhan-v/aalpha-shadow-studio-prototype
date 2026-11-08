"use client"

// Owner connections: tools through Composio (scoped to the company or to chosen teams), the
// Slack channels Shadow reads (built for big workspaces: everything on by default, rules to
// leave channels out), and when reports arrive. Connecting is simulated in the prototype.

import { useMemo, useState } from "react"
import { CheckCircle2, Landmark, Lock, Plug, Search, X } from "lucide-react"
import { Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { fmt } from "@/lib/dates"
import { CATALOG, SLACK_SCOPE, connectorsOf, matches } from "@/lib/setup"
import { useStore } from "@/lib/store"
import { teamsOf } from "@/lib/teams"
import type { Client, Connector } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ConnectorsPanel({ c, who, isOwner }: { c: Client; who: string; isOwner: boolean }) {
  const { update } = useStore()
  const list = connectorsOf(c)
  const [pending, setPending] = useState<Connector | null>(null)
  const [scope, setScope] = useState<"company" | string[]>("company")
  const teams = teamsOf(c).map((t) => t.name)
  const save = (next: Connector[], text: string) => update(c.id, (x, t) => ({ ...x, connectors: next, connections: { ...x.connections, hubspot: next.some((k) => k.on && k.name === "HubSpot"), calendar: next.some((k) => k.on && k.group === "Calendar"), callNotes: next.some((k) => k.on && k.group === "Call recording") }, log: [{ date: t, text }, ...x.log] }))
  return (
    <div data-tour="connectors"><Section title="Connectors" sub="Through Composio. Each one can cover the whole company or only the teams you pick.">
      <div className="flex flex-col gap-5">
        {CATALOG.map((g) => (
          <div key={g.group} className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">{g.group}</span>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((it) => {
                const k = list.find((x) => x.name === it.name)!
                const locked = it.ownerOnly && !isOwner
                return (
                  <div key={it.name} className={cn("flex flex-col gap-2 rounded-2xl border p-4", k.on && "border-[var(--status-good)]")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">{g.group === "Banking" ? <Landmark className="size-4" /> : <Plug className="size-4 text-[var(--text-muted)]" />}{it.name}</span>
                      {k.on ? <Pill t="good"><CheckCircle2 className="size-3.5" />Connected</Pill> : <Pill t="muted">Not connected</Pill>}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">Feeds {it.feeds.join(", ")}</span>
                    {k.on && <span className="text-xs text-[var(--text-muted)]">{k.by ? `By ${k.by}` : ""}{k.at ? ` · ${fmt(k.at)}` : ""} · {k.scope === "company" ? "Whole company" : k.scope.join(", ")}</span>}
                    {it.note && <span className="flex gap-1.5 text-xs text-[var(--watch-fg)]"><Lock className="mt-0.5 size-3 shrink-0" />{it.note}</span>}
                    <div className="mt-auto flex gap-2 pt-1">
                      {k.on
                        ? <Button size="sm" variant="ghost" className="rounded-[10px]" disabled={locked} onClick={() => save(list.map((x) => (x.id === k.id ? { ...x, on: false, by: null, at: null } : x)), `${it.name} disconnected by ${who}.`)}>Disconnect</Button>
                        : <Button size="sm" variant="outline" className="rounded-[10px]" disabled={locked} onClick={() => { setPending(k); setScope(it.ownerOnly ? ["Ops and finance"] : "company") }}>{locked ? "Owner only" : "Connect"}</Button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect {pending?.name}</DialogTitle>
            <DialogDescription>You&apos;ll sign in on Composio&apos;s page and come straight back. Shadow only reads; it never sends or changes anything.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Who it covers</span>
            {pending?.group === "Banking" ? <span className="text-[var(--text-secondary)]">Ops and finance only. Members never see it.</span> : (
              <div className="flex flex-wrap gap-1.5">
                <button aria-pressed={scope === "company"} onClick={() => setScope("company")} className={cn("h-8 rounded-full border px-3 text-xs", scope === "company" ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "")}>Whole company</button>
                {teams.map((t) => {
                  const on = Array.isArray(scope) && scope.includes(t)
                  return <button key={t} aria-pressed={on} onClick={() => setScope(Array.isArray(scope) ? (on ? scope.filter((x) => x !== t) : [...scope, t]) : [t])} className={cn("h-8 rounded-full border px-3 text-xs", on ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "")}>{t}</button>
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={Array.isArray(scope) && !scope.length} onClick={() => { if (pending) save(list.map((x) => (x.id === pending.id ? { ...x, on: true, by: who, at: null, scope } : x)), `${pending.name} connected by ${who} (${scope === "company" ? "whole company" : scope.join(", ")}).`); setPending(null) }}>Continue to Composio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section></div>
  )
}

/** Big workspaces: everything on by default, new channels join on their own, and rules leave noise out. */
export function ChannelsPanel({ c, who = "Owner", isOwner = false }: { c: Client; who?: string; isOwner?: boolean }) {
  const { s, update } = useStore()
  const today = s.today
  const k = c.connections
  const [q, setQ] = useState("")
  const [rule, setRule] = useState("")
  const ex = k.channelExclude ?? []
  const set = (p: Partial<Client["connections"]>, text: string) => update(c.id, (x, t) => ({ ...x, connections: { ...x.connections, ...p }, log: [{ date: t, text }, ...x.log] }))
  const ruled = (n: string) => ex.some((p) => matches(n, p))
  const shown = useMemo(() => k.slackChannels.filter((ch) => !q || ch.name.includes(q.replace(/^#/, "").toLowerCase())), [k.slackChannels, q])
  const on = k.slackChannels.filter((ch) => ch.on && !ruled(ch.name)).length
  return (
    <Section title="Slack channels" sub={`${on} of ${k.slackChannels.length} channels read: public channels, plus private channels the workspace admin is in. Direct messages are never read.`}>
      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm">
          <span className="flex flex-col"><span className="font-medium">Include new channels automatically</span><span className="text-xs text-[var(--text-muted)]">A new channel joins unless a rule below leaves it out</span></span>
          <Switch checked={!!k.autoNewChannels} onCheckedChange={(v) => set({ autoNewChannels: !!v }, `New Slack channels ${v ? "included" : "not included"} automatically.`)} />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Leave out channels that match</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {ex.map((p) => <span key={p} className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--surface-2)] pl-2.5 pr-1 font-mono text-xs">#{p}<button aria-label={`Remove rule ${p}`} onClick={() => set({ channelExclude: ex.filter((x) => x !== p) }, `Rule removed: #${p}.`)} className="grid size-5 place-items-center rounded-full hover:bg-card"><X className="size-3" /></button></span>)}
            <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const r = rule.trim().replace(/^#/, ""); if (!r || ex.includes(r)) return; set({ channelExclude: [...ex, r] }, `Rule added: leave out #${r}.`); setRule("") }}>
              <Input value={rule} onChange={(e) => setRule(e.target.value)} placeholder="client-*-ext" aria-label="New rule" className="h-8 w-36 rounded-[10px] font-mono text-xs" />
              <Button type="submit" size="sm" variant="outline" className="rounded-[10px]">Add rule</Button>
            </form>
          </div>
          <span className="text-xs text-[var(--text-muted)]">A * at the end matches any ending, so client-* covers every client channel. {k.slackChannels.filter((ch) => ruled(ch.name)).length} channels left out by rules.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1"><Search className="absolute top-2.5 left-3 size-4 text-[var(--text-muted)]" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels" aria-label="Search channels" className="h-9 rounded-xl pl-9" /></label>
          <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => set({ slackChannels: k.slackChannels.map((ch) => (shown.includes(ch) ? { ...ch, on: true } : ch)) }, `${shown.length} channels selected.`)}>Select {q ? "these" : "all"} ({shown.length})</Button>
          <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => set({ slackChannels: k.slackChannels.map((ch) => (shown.includes(ch) ? { ...ch, on: false } : ch)) }, `${shown.length} channels cleared.`)}>Clear {q ? "these" : "all"}</Button>
        </div>
        <div className="grid max-h-80 gap-x-6 overflow-auto rounded-2xl border px-3 sm:grid-cols-2">
          {shown.map((ch) => {
            const r = ruled(ch.name)
            return (
              <label key={ch.name} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5"><span className={cn("truncate font-mono text-xs", r && "text-[var(--text-muted)] line-through")}>#{ch.name}</span>{ch.private && <Lock className="size-3 shrink-0 text-[var(--text-muted)]" aria-label="Private" />}<span className="text-xs text-[var(--text-muted)]">{ch.members}</span></span>
                <Switch disabled={r} checked={ch.on && !r} onCheckedChange={(v) => set({ slackChannels: k.slackChannels.map((x) => (x.name === ch.name ? { ...x, on: !!v } : x)) }, `#${ch.name} ${v ? "added" : "removed"}.`)} />
              </label>
            )
          })}
        </div>
        <span className="text-xs text-[var(--text-muted)]">Private channels (lock) are included because the workspace admin is in them. Everyone is told this in the consent form.</span>
        {isOwner && (k.slackDisclosure
          ? <span className="text-xs text-[var(--delta-good)]">Confirmed by {k.slackDisclosure.by} on {fmt(k.slackDisclosure.at)}.</span>
          : <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--watch-bg)] p-3 text-sm text-[var(--watch-fg)]"><span className="min-w-0 flex-1">{SLACK_SCOPE} Your team is told the same.</span><Button size="sm" className="rounded-[10px]" onClick={() => set({ slackDisclosure: { by: who, at: today } }, `${who} confirmed what Shadow reads in Slack.`)}>I understand</Button></div>)}
      </div>
    </Section>
  )
}

export function ReportDelivery({ c }: { c: Client }) {
  const { update } = useStore()
  const r = c.reportDelivery ?? { cadence: "weekly" as const, time: "08:00" }
  const set = (p: Partial<typeof r>) => update(c.id, (x, t) => ({ ...x, reportDelivery: { ...r, ...p }, log: [{ date: t, text: `Reports set to ${p.cadence ?? r.cadence}${(p.cadence ?? r.cadence) === "realtime" ? "" : ` at ${p.time ?? r.time}`}.` }, ...x.log] }))
  return (
    <Section title="When reports arrive" sub="In Slack and in Reports">
      <div className="flex flex-wrap items-end gap-3">
        <div role="radiogroup" aria-label="Report cadence" className="flex rounded-xl border p-1">
          {([["daily", "Daily"], ["weekly", "Weekly"], ["realtime", "Real time"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={r.cadence === k} onClick={() => set({ cadence: k })} className={cn("h-8 rounded-[9px] px-3 text-sm", r.cadence === k ? "bg-[var(--graphite)] font-medium text-white" : "text-[var(--text-secondary)]")}>{l}</button>)}
        </div>
        {r.cadence !== "realtime" && <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Send at<Input type="time" value={r.time} onChange={(e) => set({ time: e.target.value })} className="h-9 w-32 rounded-[10px]" /></label>}
        <span className="text-xs text-[var(--text-muted)]">{r.cadence === "realtime" ? "Alerts post as soon as something changes." : r.cadence === "weekly" ? "Every Friday, with the Weekly Progress Update." : "Every working day."}</span>
      </div>
    </Section>
  )
}

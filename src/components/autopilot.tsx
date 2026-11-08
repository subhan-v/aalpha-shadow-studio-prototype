"use client"

// Onboarding autopilot: who is stuck where, what the sequence is about to send, what needs a
// click, and what has to be done by hand. Used per client (cockpit) and across all clients.

import { useState } from "react"
import { AlertTriangle, Bot, Check, ChevronDown, Copy, Mail, MessageSquare, Pencil, Phone, Send, SkipForward, UserRound, Zap } from "lucide-react"
import { Pill, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { fmt } from "@/lib/dates"
import { FAQ } from "@/lib/faq"
import { act, decisions, effectiveness, funnel, outbox, people, senderName, STEPS, type Item } from "@/lib/onboarding"
import { useStore } from "@/lib/store"
import type { Client, SeqStep } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

const CH_ICON = { Email: Mail, "Slack DM": MessageSquare, "Slack thread": MessageSquare, "Owner DM": UserRound, Call: Phone }
const STAGE_C = ["#86b6ef", "#5598e7", "#3987e5", "#2a78d6", "#1baf7a"]

export function Funnel({ clients }: { clients: Client[] }) {
  const { s } = useStore()
  const rows = STEPS.map((st, i) => {
    const f = clients.map((c) => funnel(c, s.today)[i])
    return { ...st, i, reached: f.reduce((n, x) => n + x.reached, 0), stuck: f.reduce((n, x) => n + x.stuck, 0), of: f.reduce((n, x) => n + x.of, 0) }
  })
  const of = rows[0].of || 1
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[120px_minmax(0,1fr)_88px] items-center gap-3 text-sm">
          <span className="text-[var(--text-secondary)]">{r.short}</span>
          <div className="h-7 rounded-lg bg-[var(--surface-2)]"><div className="flex h-7 items-center rounded-lg px-2 text-xs font-semibold text-white tabular-nums" style={{ width: `${Math.max(6, (r.reached / of) * 100)}%`, background: STAGE_C[r.i] }}>{r.reached}</div></div>
          <span className="text-right text-xs tabular-nums text-[var(--text-muted)]">{r.id === "live" ? `${Math.round((r.reached / of) * 100)}% live` : r.stuck ? <span className="text-[var(--watch-fg)]">{r.stuck} stuck here</span> : "none stuck"}</span>
        </div>
      ))}
    </div>
  )
}

function ItemCard({ it, auto }: { it: Item; auto: boolean }) {
  const { s, mutate } = useStore()
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(it.text)
  const [how, setHow] = useState(it.step.mode === "Manual")
  const Icon = CH_ICON[it.step.channel]
  const go = (st: "Sent" | "Skipped" | "Done") => mutate((x) => act(x, it, st, text))
  const sched = it.status === "scheduled"
  return (
    <div className="flex flex-col gap-2.5 border-t py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--bronze)]"><Icon className="size-4" /></span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{it.step.name}</span>
            <span className="text-xs text-[var(--text-muted)]">{it.step.channel} from {it.step.from === "Client owner" ? `${it.client.seats[0]?.name.split(" ")[0]} (their owner)` : senderName(s, it.client)} to {it.step.channel === "Owner DM" ? it.client.seats[0]?.name : it.persons.map((p) => p.seat.name).join(", ")} · {it.client.name}</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          {sched ? <Pill t="muted">{fmt(it.due)}</Pill> : it.step.stage === "concern" ? <Pill t="bad">Worried in Slack</Pill> : <Pill t="warn">Stuck {Math.max(1, Math.round(Math.max(...it.persons.map((p) => p.hours)) / 24))}d</Pill>}
        </span>
      </div>
      {it.quote && <p className="border-l-2 border-[var(--border)] pl-3 text-sm text-[var(--text-secondary)]">&ldquo;{it.quote}&rdquo;</p>}
      {edit ? <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-24 rounded-xl text-sm" aria-label="Message" /> : <p className="whitespace-pre-line rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-relaxed">{text}</p>}
      {it.step.howTo && (
        <div className="flex flex-col gap-1.5">
          <button onClick={() => setHow(!how)} className="flex items-center gap-1 self-start text-xs font-medium text-[var(--text-secondary)]"><ChevronDown className={cn("size-3.5 transition-transform", !how && "-rotate-90")} />How to do it by hand</button>
          {how && <ol className="ml-5 list-decimal space-y-1 text-sm text-[var(--text-secondary)]">{it.step.howTo.map((h) => <li key={h}>{h}</li>)}</ol>}
        </div>
      )}
      {!sched && (
        <div className="flex flex-wrap gap-2">
          {it.step.mode === "Manual" ? (
            <>
              <Button size="sm" className="rounded-[10px]" onClick={() => go("Done")}><Check />Mark done</Button>
              <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => navigator.clipboard?.writeText(text)}><Copy />Copy message</Button>
            </>
          ) : (
            <Button size="sm" className="rounded-[10px]" onClick={() => go("Sent")}><Send />{auto && it.step.mode === "Auto" ? "Send now" : "Approve and send"}</Button>
          )}
          <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setEdit(!edit)}><Pencil />{edit ? "Done editing" : "Edit"}</Button>
          <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => go("Skipped")}><SkipForward />Skip</Button>
        </div>
      )}
    </div>
  )
}

function GroupCard({ items }: { items: Item[] }) {
  const { mutate } = useStore()
  const [each, setEach] = useState(false)
  if (items.length === 1 || each) return <>{items.map((it) => <ItemCard key={it.key} it={it} auto={false} />)}</>
  const it = items[0]
  const Icon = CH_ICON[it.step.channel]
  const manual = it.step.mode === "Manual"
  return (
    <div className="flex flex-col gap-2.5 border-t py-3.5 first:border-t-0">
      <span className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--bronze)]"><Icon className="size-4" /></span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{it.step.name} · {items.length} people</span>
          <span className="text-xs text-[var(--text-muted)]">{it.step.channel} · {it.client.name} · {items.map((x) => x.persons[0].seat.name).join(", ")}</span>
        </span>
      </span>
      <p className="whitespace-pre-line rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-relaxed">{it.text}<span className="mt-1 block text-xs text-[var(--text-muted)]">Each person gets their own name.</span></p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-[10px]" onClick={() => mutate((x) => items.reduce((acc, y) => act(acc, y, manual ? "Done" : "Sent"), x))}>{manual ? <Check /> : <Send />}{manual ? `Mark all ${items.length} done` : `Approve and send all ${items.length}`}</Button>
        <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => setEach(true)}>Review one by one</Button>
        <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => mutate((x) => items.reduce((acc, y) => act(acc, y, "Skipped"), x))}><SkipForward />Skip all</Button>
      </div>
    </div>
  )
}

export function Outbox({ clients }: { clients: Client[] }) {
  const { s, mutate } = useStore()
  const items = clients.flatMap((c) => outbox(s, c))
  const due = items.filter((x) => x.status === "due")
  const on = (c: Client) => s.autopilot[c.id] !== false
  const autoNow = due.filter((x) => x.step.mode === "Auto" && on(x.client))
  const groups = decisions(s, items)
  const approve = groups.filter((g) => g[0].step.mode !== "Manual")
  const manual = groups.filter((g) => g[0].step.mode === "Manual")
  const soon = items.filter((x) => x.status === "scheduled").sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8)
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Section title="Needs your OK" sub="Messages in someone's name, and anything for a client with autopilot off" right={<Pill t={approve.length ? "warn" : "good"}>{approve.length}</Pill>}>
        {approve.length ? approve.map((g) => <GroupCard key={g[0].key} items={g} />) : <p className="text-sm text-[var(--text-muted)]">Nothing waiting.</p>}
      </Section>
      <Section title="Do by hand" sub="Calls and fixes a message can't do, with the steps" right={<Pill t={manual.length ? "warn" : "good"}>{manual.length}</Pill>}>
        {manual.length ? manual.map((g) => <GroupCard key={g[0].key} items={g} />) : <p className="text-sm text-[var(--text-muted)]">Nothing to do by hand.</p>}
      </Section>
      <Section title="Sending automatically" sub="Goes out at 9:00 in each person's time zone (simulated in this prototype)" right={autoNow.length > 0 && <Button size="sm" className="rounded-[10px]" onClick={() => mutate((x) => autoNow.reduce((acc, it) => act(acc, it, "Sent"), x))}><Zap />Send all {autoNow.length} now</Button>}>
        {autoNow.length ? autoNow.map((it) => <ItemCard key={it.key} it={it} auto />) : <p className="text-sm text-[var(--text-muted)]">Nothing due today.</p>}
      </Section>
      <Section title="Coming up" sub="The next message for each stuck person, if they don't move first">
        {soon.length ? soon.map((it) => <ItemCard key={it.key} it={it} auto />) : <p className="text-sm text-[var(--text-muted)]">Nothing scheduled.</p>}
      </Section>
    </div>
  )
}

export function PeopleTable({ c }: { c: Client }) {
  const { s } = useStore()
  const ps = people(c, s.today)
  const lastSend = (id: string) => s.sends.find((x) => x.clientId === c.id && x.seatIds.includes(id) && x.status === "Sent")
  return (
    <Section title="Everyone on the team" sub="Where each person is, and the last message they got">
      <div className="flex flex-col">
        {ps.map((p) => (
          <div key={p.seat.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <span className="flex min-w-0 flex-col"><span className="truncate text-sm font-medium">{p.seat.name}</span><span className="text-xs text-[var(--text-muted)]">{p.seat.role}</span></span>
            <span className="hidden items-center gap-1 sm:flex" aria-label={`${p.done} of 4 steps done`}>
              {STEPS.slice(0, -1).map((st, i) => <span key={st.id} title={st.label} className="h-2 flex-1 rounded-full" style={{ background: i < p.done ? STAGE_C[4] : i === p.done ? "var(--status-warning)" : "var(--surface-2)" }} />)}
            </span>
            <span className="flex flex-col items-end text-right">
              {p.stage === "live" ? <Pill t="good">Live</Pill> : <Pill t={p.hours >= 72 ? "bad" : "warn"}>{STEPS.find((x) => x.id === p.stage)!.label}{p.hours >= 24 ? ` · ${Math.round(p.hours / 24)}d` : ""}</Pill>}
              <span className="mt-0.5 text-xs text-[var(--text-muted)]">{lastSend(p.seat.id) ? `Nudged ${fmt(lastSend(p.seat.id)!.at)}` : p.seat.nudgedAt ? `Nudged ${fmt(p.seat.nudgedAt)}` : "No nudge yet"}</span>
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function AutopilotSwitch({ c }: { c: Client }) {
  const { s, mutate } = useStore()
  const on = s.autopilot[c.id] !== false
  return (
    <label className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
      <span className={cn("grid size-8 place-items-center rounded-full", on ? "bg-[var(--good-bg)] text-[var(--delta-good)]" : "bg-[var(--surface-2)] text-[var(--text-muted)]")}><Bot className="size-4" /></span>
      <span className="flex flex-1 flex-col"><span className="text-sm font-medium">Autopilot {on ? "on" : "off"}</span><span className="text-xs text-[var(--text-muted)]">{on ? "Auto messages send themselves. Messages in someone's name still wait for a click." : "Nothing sends without a click."}</span></span>
      <Switch checked={on} onCheckedChange={(v) => mutate((x) => ({ ...x, autopilot: { ...x.autopilot, [c.id]: !!v } }))} aria-label="Autopilot" />
    </label>
  )
}

/** The message ladder: when each message fires, how it goes out, and how well it works. */
export function SequenceEditor() {
  const { s, mutate } = useStore()
  const [open, setOpen] = useState<SeqStep | null>(null)
  const set = (id: string, p: Partial<SeqStep>) => mutate((x) => ({ ...x, sequence: x.sequence.map((y) => (y.id === id ? { ...y, ...p } : y)) }))
  const groups = [...STEPS.slice(0, -1).map((x) => ({ id: x.id, label: `Stuck on: ${x.label.toLowerCase()}` })), { id: "concern", label: "Asked in Slack" }]
  return (
    <div className="flex flex-col gap-4">
      <Section title="Who the messages come from" sub="Every message to a client comes from Subhan (owner rule, 2026-10-30)">
        <p className="text-sm text-[var(--text-secondary)]">Requests, nudges, reports and customer success all go out as Subhan, CEO. Anyone on the Aalpha team can draft or queue a message here; the client always sees Subhan as the sender, never a specialist, &ldquo;{APP}&rdquo; or a support inbox.</p>
        <p className="mt-3 text-xs text-[var(--text-muted)]">The note from the client&apos;s own owner stays in their name and always waits for a click.</p>
      </Section>
      {groups.map((g) => (
        <Section key={g.id} title={g.label}>
          {s.sequence.filter((x) => x.stage === g.id).sort((a, b) => a.after - b.after).map((st) => {
            const e = effectiveness(st)
            const Icon = CH_ICON[st.channel]
            return (
              <div key={st.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t py-3 first:border-t-0", !st.on && "opacity-50")}>
                <span className="w-16 text-xs tabular-nums text-[var(--text-muted)]">{st.after === 0 ? "Right away" : st.after < 24 ? `${st.after} h` : `Day ${Math.round(st.after / 24)}`}</span>
                <button onClick={() => setOpen(st)} className="flex min-w-0 items-center gap-2.5 text-left">
                  <Icon className="size-4 shrink-0 text-[var(--text-muted)]" />
                  <span className="flex min-w-0 flex-col"><span className="truncate text-sm font-medium hover:underline">{st.name}</span><span className="text-xs text-[var(--text-muted)]">{st.channel} from {st.from === "Client owner" ? "the client's owner" : s.sender === "Subhan" ? "Subhan" : "the assigned specialist"} · {st.mode === "Auto" ? "sends itself" : st.mode === "Approve" ? "waits for a click" : "done by hand"}</span></span>
                </button>
                <span className="flex items-center gap-3">
                  <span className="hidden flex-col items-end sm:flex"><span className={cn("text-sm font-semibold tabular-nums", e.rate < 25 ? "text-[var(--delta-bad)]" : e.rate >= 50 ? "text-[var(--delta-good)]" : "")}>{e.rate}%</span><span className="text-xs text-[var(--text-muted)]">move on in 48 h</span></span>
                  <Switch checked={st.on} onCheckedChange={(v) => set(st.id, { on: !!v })} aria-label={`${st.name} on`} />
                </span>
              </div>
            )
          })}
        </Section>
      ))}
      <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><AlertTriangle className="size-3.5" />&ldquo;Move on in 48 h&rdquo; is sample data in the prototype. Under 25% is red: rewrite it or send it from a person.</p>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="data-[side=right]:sm:max-w-xl">
          {open && (() => {
            const st = s.sequence.find((x) => x.id === open.id)!
            return (
              <>
                <SheetHeader><SheetTitle>{st.name}</SheetTitle><SheetDescription>Changes apply to every client. Keep it to two short lines. Use {"{first}"}, {"{owner}"}, {"{sender}"}, {"{names}"}, {"{link}"}.</SheetDescription></SheetHeader>
                <div className="flex flex-col gap-4 px-4 pb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">How it goes out
                      <Select value={st.mode} onValueChange={(v) => v && set(st.id, { mode: v as SeqStep["mode"] })}>
                        <SelectTrigger className="h-9 rounded-[10px]"><SelectValue>{st.mode === "Auto" ? "Sends itself" : st.mode === "Approve" ? "Waits for a click" : "Done by hand"}</SelectValue></SelectTrigger>
                        <SelectContent><SelectItem value="Auto">Sends itself</SelectItem><SelectItem value="Approve">Waits for a click</SelectItem><SelectItem value="Manual">Done by hand</SelectItem></SelectContent>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Hours stuck before it fires
                      <input type="number" min={0} value={st.after} onChange={(e) => set(st.id, { after: Number(e.target.value) })} className="h-9 rounded-[10px] border bg-transparent px-3 text-sm text-[var(--text-primary)]" />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Message<Textarea value={st.body} onChange={(e) => set(st.id, { body: e.target.value })} className="min-h-40 rounded-xl text-sm text-[var(--text-primary)]" /></label>
                  {(() => { const e = effectiveness(st); return <div className="grid grid-cols-3 gap-2 text-center">{[["Sent", e.sent], ["Move on in 48 h", `${e.rate}%`], ["Median to move", `${e.medianHrs} h`]].map(([k, v]) => <div key={String(k)} className="rounded-xl bg-[var(--surface-2)] p-3"><div className="text-lg font-semibold tabular-nums">{v}</div><div className="text-xs text-[var(--text-muted)]">{k}</div></div>)}</div> })()}
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** The questions people ask before installing, with the approved short answers. */
export function CommonQuestions() {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <Section title="Common questions" sub="From the first beta teams, mostly people installing on their own laptop. These are the approved answers; Slack replies and the welcome note use them.">
      {[...FAQ].sort((a, b) => b.asked - a.asked).map((f) => (
        <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t py-3 first:border-t-0">
          <span className="flex flex-col gap-1"><span className="text-sm font-medium">{f.q}</span><span className="text-sm text-[var(--text-secondary)]">{f.a}</span></span>
          <span className="flex flex-col items-end gap-1">
            <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => { navigator.clipboard?.writeText(f.a); setCopied(f.id) }}>{copied === f.id ? <Check /> : <Copy />}{copied === f.id ? "Copied" : "Copy"}</Button>
            <span className="text-xs tabular-nums text-[var(--text-muted)]">asked {f.asked}x</span>
          </span>
        </div>
      ))}
    </Section>
  )
}

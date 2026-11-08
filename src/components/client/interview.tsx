"use client"

// The 5-minute interview. The conversation runs on the left; on the right a dashboard fills in
// with a card for everything heard: goals with their number, workflows drawn as steps with the
// tools and the hours Shadow captured, pain points, hand-offs and things never to automate. Each
// card carries the quote it came from and can be fixed (edit, reorder, remove) and confirmed.
// At the end, "Here's where this goes" shows every confirmed card's destination and exactly what
// the manager will see, then approval maps it all in. A mock: sample answers, no microphone.

import { useState } from "react"
import { ArrowDown, ArrowUp, Ban, Check, CheckCircle2, Hand, Lightbulb, Mic, Pencil, RotateCcw, Target, Trash2, UserRound, Workflow as WfIcon } from "lucide-react"
import { Pill, Section } from "@/components/bits"
import { ToolChip } from "@/components/sop-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WK_TO_MO } from "@/lib/client-data"
import { fmt } from "@/lib/dates"
import { applyInterview, CARDS, destination, summaryOf, type Card, type CardKind } from "@/lib/interview"
import { interviewSetFor, questionsFor, SET_LABEL } from "@/lib/setup"
import { useStore } from "@/lib/store"
import type { Client, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

const ICON: Record<CardKind, typeof Target> = { Goal: Target, Workflow: WfIcon, "Pain point": Lightbulb, "Hand-off": Hand, "Never automate": Ban, "Role note": UserRound }
const TONE: Record<CardKind, string> = { Goal: "text-[var(--bronze)]", Workflow: "text-[#2a78d6]", "Pain point": "text-[var(--watch-fg)]", "Hand-off": "text-[var(--delta-good)]", "Never automate": "text-[var(--delta-bad)]", "Role note": "text-[#6250d6]" }

export function InterviewView({ c, me, owner = false }: { c: Client; me: Seat; owner?: boolean }) {
  // The owner has no manager: their summary is shared with Subhan instead.
  const sees = owner ? "Subhan sees" : "your manager sees"
  const { s, update } = useStore()
  const set = interviewSetFor(me)
  const qs = questionsFor(s, set).slice(0, 5)
  const [step, setStep] = useState(me.interview ? 99 : -1) // -1 intro, 0..4 questions, 5 where it goes
  const [cards, setCards] = useState<Card[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const heardUpTo = (n: number) => CARDS[set].filter((k) => k.q < n)
  const next = () => {
    const n = step + 1
    // Keep any fixes already made; add the cards for the answer just given.
    setCards((cur) => [...cur, ...heardUpTo(n).filter((k) => !cur.some((x) => x.id === k.id)).map((k) => ({ ...k }))])
    setStep(n)
  }
  const patch = (id: string, p: Partial<Card>) => setCards((cur) => cur.map((k) => (k.id === id ? { ...k, ...p } : k)))
  const confirmed = cards.filter((k) => k.ok)
  const approve = () => update(c.id, (x, t) => ({ ...applyInterview(x, x.seats.find((y) => y.id === me.id)!, set, confirmed, t), log: [{ date: t, text: `${me.name} approved their interview: ${confirmed.length} items mapped. Audio deleted.` }, ...x.log] }))

  if (me.interview && step === 99) {
    const m = me.interview.mapped
    return (
      <div data-tour="interview"><Section title="Your interview" sub={`Approved ${fmt(me.interview.at)} · ${SET_LABEL[me.interview.role]} questions`} right={<Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => { setCards([]); setStep(-1) }}><RotateCcw />Redo it</Button>}>
        <p className="rounded-2xl bg-[var(--surface-2)] p-4 text-sm leading-relaxed">{me.interview.summary ?? "Summary approved."}</p>
        {m && <div className="mt-3 flex flex-wrap gap-2 text-xs">{([[m.workflows, "workflow verified", "workflows verified"], [m.handoffs, "hand-off", "hand-offs"], [m.goals, "goal", "goals"], [m.never, "never automate", "never automate"], [m.notes, "role note", "role notes"]] as [number, string, string][]).filter(([n]) => n).map(([n, one, many]) => <Pill key={one} t="info">{n} {n === 1 ? one : many}</Pill>)}</div>}
        <p className="mt-3 text-xs text-[var(--text-muted)]">This is what {sees}. The audio was deleted after processing; the transcript and this summary are kept.</p>
      </Section></div>
    )
  }

  return (
    <div data-tour="interview" className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border bg-[var(--graphite)] p-6 text-white xl:sticky xl:top-16 xl:self-start">
        <span className="flex items-center justify-between text-xs text-white/60"><span>5-minute interview · {SET_LABEL[set]}</span><span>{step < 0 ? "Ready" : step < qs.length ? `Question ${step + 1} of ${qs.length}` : "Done"}</span></span>
        <div className="flex max-h-72 flex-col gap-2 overflow-auto">
          {qs.slice(0, Math.max(0, Math.min(step, qs.length))).map((q, i) => (
            <div key={i} className="flex flex-col gap-1 text-sm"><span className="text-white/60">{q}</span><span className="rounded-xl bg-white/10 px-3 py-2">&ldquo;{CARDS[set].find((k) => k.q === i)?.quote}&rdquo;</span></div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3 py-3">
          <span className={cn("grid size-20 place-items-center rounded-full bg-[var(--bronze)]", step >= 0 && step < qs.length && "animate-pulse")}><Mic className="size-8" /></span>
          <p className="text-center text-lg font-semibold leading-snug">{step < 0 ? `Hi ${me.name.split(" ")[0]}. Five quick questions about your work. Talk like you would to a colleague.` : step < qs.length ? qs[step] : "That's everything. Check the cards, then see where they go."}</p>
          {step >= 0 && step < qs.length && <span className="text-xs text-white/60">Say &ldquo;change that&rdquo; or &ldquo;remove that&rdquo; any time to fix a card.</span>}
        </div>
        <div className="flex gap-2">
          {step < 0 && <Button className="rounded-[10px] bg-white text-[var(--graphite)] hover:bg-white/90" onClick={() => setStep(0)}><Mic />Start talking</Button>}
          {step >= 0 && step < qs.length && <Button className="rounded-[10px] bg-white text-[var(--graphite)] hover:bg-white/90" onClick={next}>{step === qs.length - 1 ? "Finish" : "Next question"}</Button>}
        </div>
        <span className="text-xs text-white/50">Audio is deleted after processing. The transcript and summary are kept. Mock: sample answers, no microphone.</span>
      </div>

      <div className="flex flex-col gap-4">
        <Section title="What we're hearing" sub="Fix anything by clicking, then tick it to confirm" right={cards.length > 0 ? <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => setCards((cur) => cur.map((k) => ({ ...k, ok: true })))}><Check />Confirm all</Button> : undefined}>
          {cards.length === 0 && <p className="text-sm text-[var(--text-muted)]">Goals, workflows, pain points and hand-offs show up here as you answer.</p>}
          <div className="flex flex-col gap-2.5">
            {cards.map((k) => {
              const Icon = ICON[k.kind]
              const wf = k.wf ? c.workflows.find((w) => w.name === k.wf) : null
              return (
                <div key={k.id} className={cn("flex flex-col gap-2 rounded-2xl border p-3.5", k.ok && "border-[var(--status-good)] bg-[var(--good-bg)]/40")}>
                  <div className="flex items-start gap-2.5">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[k.kind])} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-xs text-[var(--text-muted)]">{k.kind}{k.number && ` · ${k.number}`}</span>
                      {editing === k.id ? <Input autoFocus value={k.text} onChange={(e) => patch(k.id, { text: e.target.value })} onKeyDown={(e) => e.key === "Enter" && setEditing(null)} aria-label="Edit card" className="h-8 rounded-[10px] text-sm" /> : <span className="text-sm font-medium">{k.text}</span>}
                    </span>
                    <span className="flex shrink-0 gap-0.5">
                      <Button size="icon-sm" variant="ghost" aria-label={editing === k.id ? "Done editing" : `Edit ${k.text}`} onClick={() => setEditing(editing === k.id ? null : k.id)}>{editing === k.id ? <Check /> : <Pencil />}</Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${k.text}`} onClick={() => setCards((cur) => cur.filter((x) => x.id !== k.id))}><Trash2 /></Button>
                      <Button size="icon-sm" variant={k.ok ? "default" : "outline"} aria-pressed={!!k.ok} aria-label={k.ok ? `Unconfirm ${k.text}` : `Confirm ${k.text}`} onClick={() => patch(k.id, { ok: !k.ok })}><Check /></Button>
                    </span>
                  </div>
                  {k.steps && (
                    <ol className="ml-6 flex flex-col gap-1">
                      {k.steps.map((st, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs">{i + 1}</span>
                          <span className="flex-1">{st}</span>
                          <button aria-label={`Move "${st}" up`} disabled={i === 0} onClick={() => { const a = [...k.steps!]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; patch(k.id, { steps: a }) }} className="text-[var(--text-muted)] disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                          <button aria-label={`Move "${st}" down`} disabled={i === k.steps!.length - 1} onClick={() => { const a = [...k.steps!]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; patch(k.id, { steps: a }) }} className="text-[var(--text-muted)] disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                          <button aria-label={`Remove step "${st}"`} onClick={() => patch(k.id, { steps: k.steps!.filter((_, j) => j !== i) })} className="text-[var(--text-muted)]"><Trash2 className="size-3.5" /></button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {(k.tools || wf) && (
                    <div className="ml-6 flex flex-wrap items-center gap-1.5">
                      {k.tools?.map((t) => <ToolChip key={t} t={t} compact />)}
                      {wf && k.kind === "Workflow" && <span className="text-xs text-[var(--text-secondary)]">{APP} captured {Math.round(wf.hoursWk * WK_TO_MO)} h a month of this</span>}
                    </div>
                  )}
                  <span className="ml-6 text-xs italic text-[var(--text-muted)]">&ldquo;{k.quote}&rdquo;</span>
                </div>
              )
            })}
          </div>
        </Section>

        {step >= qs.length && step !== 99 && (
          <Section title="Here's where this goes" sub={`${confirmed.length} of ${cards.length} confirmed. Anything not confirmed is left out.`}>
            {confirmed.length === 0 && <p className="text-sm text-[var(--text-muted)]">Tick the cards that are right to see where each one goes.</p>}
            <ul className="flex flex-col gap-2">
              {confirmed.map((k) => { const Icon = ICON[k.kind]; return <li key={k.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-sm"><Icon className={cn("mt-0.5 size-4", TONE[k.kind])} /><span><b className="font-medium">{k.text}</b><span className="block text-xs text-[var(--text-secondary)]">{destination(c, me, set, k)}</span></span></li> })}
            </ul>
            {confirmed.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                <span className="text-sm font-medium">What {owner ? "Subhan" : "your manager"} will see</span>
                <p className="rounded-2xl bg-[var(--surface-2)] p-4 text-sm leading-relaxed">{summaryOf(confirmed)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="rounded-[10px]" onClick={() => { approve(); setStep(99) }}><CheckCircle2 />Approve and map it</Button>
                  <Button variant="ghost" className="rounded-[10px]" onClick={() => { setCards([]); setStep(-1) }}><RotateCcw />Redo</Button>
                  <Pill t="muted">Nothing is shared until you approve</Pill>
                </div>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  )
}

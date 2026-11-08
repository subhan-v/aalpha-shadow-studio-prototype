"use client"

// Member onboarding as one conversation (v20, modelled on the CI trial onboarding): the invite link
// opens a full page where the guide talks them through each step as a card they act on, then runs
// the 5-minute interview in the same chat, then hands them into their space in the portal.
// Questions at any point: answered from the approved common questions, else sent to Subhan.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ArrowUp, Check, CheckCircle2, Circle, Download, Loader2, Mic, Pencil, Puzzle, ShieldCheck } from "lucide-react"
import { bestAnswer } from "@/components/client/support"
import { Button } from "@/components/ui/button"
import { agree as agreeTo, hasConsent } from "@/lib/consent"
import { faq } from "@/lib/faq"
import { applyInterview, CARDS, summaryOf, type Card } from "@/lib/interview"
import { newRequest } from "@/lib/requests"
import { CONSENT_POINTS, interviewSetFor, onboardingSteps, questionsFor } from "@/lib/setup"
import { useStore } from "@/lib/store"
import type { Client, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"

type Stage = "slack" | "consent" | "install" | "perms" | "extension" | "interview" | "done"
type Msg = { id: string; who: "guide" | "you"; text: string; card?: "slack" | "consent" | "install" | "perms" | "extension" | "interview" | "heard" | "summary" | "done" | "subhan"; q?: number; ask?: string }

const HUE: Record<Stage, string> = { slack: "#e7c9a6", consent: "#c9dccb", install: "#c8d6ea", perms: "#d9cde8", extension: "#e8d3c4", interview: "#cfe0dc", done: "#e9dfb8" }
const CHECKS = ["Shadow app connected", "Screen Recording on", "Accessibility on", "Input Monitoring on", "Your hours reached the laptop", "First upload received"]
const CHIPS: Record<Stage, string[]> = { slack: ["own-laptop", "who-looks"], consent: ["captures", "slack", "private"], install: ["permissions", "security"], perms: ["permissions", "pause"], extension: ["chrome"], interview: ["interview", "manager"], done: ["manager", "pause"] }

function say(st: Stage, first: string): Msg[] {
  const id = `${st}-${Date.now()}`
  switch (st) {
    case "slack": return [{ id, who: "guide", text: "First, sign in with Slack so I know it's you.", card: "slack" }]
    case "consent": return [{ id, who: "guide", text: "Before anything goes on your laptop, here's exactly what Shadow records and what it never does.", card: "consent" }]
    case "install": return [{ id, who: "guide", text: "Thanks. Step 1 of 4: download the Shadow app for your work Mac. About 3 minutes.", card: "install" }]
    case "perms": return [{ id, who: "guide", text: "Step 2 of 4: let's check it's working. I'll look at the app, the 3 Mac permissions and your hours.", card: "perms" }]
    case "extension": return [{ id, who: "guide", text: "Step 3 of 4: add the Shadow extension to Chrome, in your work profile. This will let us know which profile we should focus on when it comes to your work, and we can avoid looking at any other profiles.", card: "extension" }]
    case "interview": return [{ id, who: "guide", text: "Last step: a 5-minute interview, right here. Five questions about your work. Answer by voice or type, and you approve the summary before anyone sees it. The audio is deleted after.", card: "interview" }]
    case "done": return [{ id, who: "guide", text: `That's everything, ${first}. Thank you. Shadow is recording your work hours, and your first findings show up after Aalpha reviews them, usually within a week.`, card: "done" }]
  }
}

export function JoinChat({ c, me }: { c: Client; me: Seat }) {
  const { s, update, mutate } = useStore()
  const router = useRouter()
  const first = me.name.split(" ")[0]
  const owner = c.seats[0].name.split(" ")[0]
  const set = interviewSetFor(me)
  const qs = questionsFor(s, set).slice(0, 5)
  const steps = onboardingSteps(c, me, "Member", s.today)
  const setupStage = (steps.find((x) => !x.done)?.k ?? "done") as Stage
  // The interview runs inside this chat: qi is the question being answered, -1 before it starts.
  const [qi, setQi] = useState(me.interview ? 5 : -1)
  const [heard, setHeard] = useState<Card[]>([])
  const [fixing, setFixing] = useState<string | null>(null)
  const [checking, setChecking] = useState(-1)
  const [listening, setListening] = useState(false)
  const [text, setText] = useState("")
  const stage: Stage = setupStage === "interview" ? "interview" : setupStage
  const [log, setLog] = useState<Msg[]>(() => [{ id: "hi", who: "guide", text: `Hi ${first}, I'm your Shadow guide. ${owner} brought Aalpha in to take the boring, repetitive work off the team's plate. I'll walk you through setup right here. It takes about 10 minutes, and you can ask me anything along the way.` }, ...say(stage, first)])
  const seen = useRef<string>(stage)
  const end = useRef<HTMLDivElement>(null)

  // The guide speaks up each time a setup step finishes.
  useEffect(() => {
    if (seen.current === stage) return
    seen.current = stage
    setLog((l) => [...l, ...say(stage, first)])
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [log, checking, listening])

  const seat = (fn: (y: Seat, t: string) => Seat, what: string) => update(c.id, (x, t) => ({ ...x, seats: x.seats.map((y) => (y.id === me.id ? fn(y, t) : y)), log: [{ date: t, text: `${me.name} ${what}.` }, ...x.log] }))
  const you = (t: string) => setLog((l) => [...l, { id: `y${Date.now()}${l.length}`, who: "you", text: t }])
  const guide = (m: Omit<Msg, "id" | "who">) => setLog((l) => [...l, { id: `g${Date.now()}${l.length}`, who: "guide", ...m }])

  const signIn = () => { you("Signed in with Slack"); seat((y) => ({ ...y, slack: { handle: me.name.toLowerCase().replace(/[^a-z]+/g, "."), display: me.name, email: `${first.toLowerCase()}@${c.slackSlug}.com`, hue: 210 } }), "signed in with Slack") }
  const agree = () => { you("I agree"); update(c.id, (x, t) => ({ ...x, seats: x.seats.map((y) => (y.id === me.id ? agreeTo(x, y, t) : y)), log: [{ date: t, text: `${me.name} agreed to ${x.consentVersion ?? "the consent form"}.` }, ...x.log] })) }
  const install = () => { you("Downloaded and opened the app"); seat((y, t) => ({ ...y, installAt: t, permissions: false, extension: false }), "installed Shadow") }
  const runCheck = () => {
    setChecking(0)
    CHECKS.forEach((_, i) => setTimeout(() => setChecking(i + 1), 420 * (i + 1)))
    setTimeout(() => { seat((y) => ({ ...y, permissions: true }), "passed the verification check"); setChecking(-1) }, 420 * (CHECKS.length + 1))
  }
  const addExt = () => { you("Added the extension"); seat((y) => ({ ...y, extension: true }), "added the Chrome extension to their work profile") }

  // Interview: one question at a time. Voice is simulated with the sample answers for this role.
  const askQ = (n: number) => guide({ text: `${n + 1} of 5. ${qs[n]}`, q: n })
  const startInterview = () => { you("Let's do it"); setQi(0); askQ(0) }
  const answer = (typed?: string) => {
    const cards = CARDS[set].filter((k) => k.q === qi).map((k) => ({ ...k, ok: true }))
    const finish = (said: string) => {
      you(said)
      setHeard((h) => [...h, ...cards])
      guide({ text: cards.length ? "Here's what I heard. Fix anything that's off." : "Got it, thank you.", card: cards.length ? "heard" : undefined, q: qi })
      const n = qi + 1
      setQi(n)
      if (n < qs.length) setTimeout(() => askQ(n), 500)
      else setTimeout(() => guide({ text: "That's all five. Here's the summary your manager will see. Change anything, then approve it.", card: "summary" }), 500)
    }
    if (typed !== undefined) return finish(typed)
    setListening(true)
    setTimeout(() => { setListening(false); finish(cards.map((k) => k.quote).join(" ") || "That's most of it, really.") }, 1300)
  }
  const fix = (id: string, t: string) => { setHeard((h) => h.map((k) => (k.id === id ? { ...k, text: t } : k))); setFixing(null) }
  const drop = (id: string) => setHeard((h) => h.map((k) => (k.id === id ? { ...k, ok: false } : k)))
  const approve = () => {
    const ok = heard.filter((k) => k.ok)
    you("Approve")
    update(c.id, (x, t) => ({ ...applyInterview(x, x.seats.find((y) => y.id === me.id)!, set, ok, t), log: [{ date: t, text: `${me.name} approved their interview in setup: ${ok.length} items mapped. Audio deleted.` }, ...x.log] }))
  }
  const openSpace = () => {
    update(c.id, (x) => {
      const p = x.prefs[me.id] ?? { pausedUntil: null, start: null, end: null, block: [], allow: [] }
      return { ...x, prefs: { ...x.prefs, [me.id]: { ...p, checklist: Array.from(new Set([...(p.checklist ?? []), "complete"])) } } }
    })
    router.push(`/client/${c.id}?role=Member&tab=me`)
  }

  // Free questions: approved answers only; anything else can go to Subhan.
  const ask = (q: string) => {
    if (!q.trim()) return
    you(q)
    const f = bestAnswer(q)
    guide(f ? { text: f.a } : { text: "I don't have an approved answer for that one. Want me to send it to Subhan? You'll get a reply here and in Slack.", card: "subhan", ask: q })
    setText("")
  }
  const toSubhan = (q: string, id: string) => {
    mutate((p) => newRequest(p, { clientId: c.id, from: me.name, source: "Member", kind: "Question", title: q.slice(0, 80), detail: `${q}\n\nAsked during setup.`, priority: "Normal", assignee: "Subhan" }))
    setLog((l) => l.map((m) => (m.id === id ? { ...m, card: undefined } : m)).concat({ id: `g${Date.now()}`, who: "guide", text: "Sent. Subhan will reply here and in Slack. Let's keep going in the meantime." }))
  }

  const inInterview = stage === "interview" && qi >= 0 && qi < qs.length
  const done = steps.filter((x) => x.done).length
  const pct = Math.round((done / steps.length) * 100)

  // A plain function, not a component, so cards don't remount on every message.
  function cardFor(m: Msg) {
    const box = "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm"
    const live = (k: Stage) => stage === k
    switch (m.card) {
      case "slack": return <div className={box}>{live("slack") ? <Button className="w-fit rounded-[10px] bg-[#4a154b] hover:bg-[#4a154b]/90" onClick={signIn}>Sign in with Slack</Button> : <Done t={`Signed in as @${me.slack?.handle ?? first.toLowerCase()}`} />}</div>
      case "consent": return (
        <div className={box}>
          <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-[var(--delta-good)]" />What Shadow records, and what it never does</span>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-[var(--text-secondary)]">{CONSENT_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
          {hasConsent(c, me) ? <Done t="You agreed. You can withdraw it in Settings." /> : <Button className="w-fit rounded-[10px]" onClick={agree}>I agree</Button>}
        </div>
      )
      case "install": return <div className={box}>{live("install") ? <><p className="text-sm text-[var(--text-secondary)]">When it opens, sign in with Slack and allow the 3 permissions it asks for: Screen Recording, Accessibility and Input Monitoring.</p><Button className="w-fit rounded-[10px]" onClick={install}><Download />Download for Mac</Button></> : <Done t="Shadow is on your Mac" />}</div>
      case "perms": return (
        <div className={box}>
          <ul className="flex flex-col gap-1.5 text-sm">{CHECKS.map((x, i) => { const ok = !live("perms") || checking > i; return <li key={x} className="flex items-center gap-2">{ok ? <CheckCircle2 className="size-4 text-[var(--status-good)]" /> : checking === i ? <Loader2 className="size-4 animate-spin text-[var(--text-muted)]" /> : <Circle className="size-4 text-[var(--text-muted)]" />}{x}</li> })}</ul>
          {live("perms") && <Button className="w-fit rounded-[10px]" disabled={checking >= 0} onClick={runCheck}>{checking >= 0 ? "Checking…" : "Run the check"}</Button>}
        </div>
      )
      case "extension": return <div className={box}>{live("extension") ? <Button className="w-fit rounded-[10px]" onClick={addExt}><Puzzle />Add to Chrome</Button> : <Done t="Extension on your work profile" />}</div>
      case "interview": return <div className={box}>{qi < 0 ? <div className="flex flex-wrap gap-2"><Button className="rounded-[10px]" onClick={startInterview}><Mic />Start the interview</Button></div> : <Done t={qi >= qs.length ? "Interview done" : "In progress below"} />}</div>
      case "heard": {
        const mine = heard.filter((k) => k.q === m.q)
        return (
          <div className={box}>
            {mine.map((k) => (
              <div key={k.id} className={cn("flex flex-wrap items-start gap-2 text-sm", !k.ok && "opacity-50 line-through")}>
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">{k.kind}</span>
                {fixing === k.id
                  ? <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); fix(k.id, (e.currentTarget.elements.namedItem("t") as HTMLInputElement).value) }}><input name="t" defaultValue={k.text} className="h-8 min-w-0 flex-1 rounded-lg border px-2 text-sm" autoFocus /><Button size="sm" className="rounded-[10px]">Save</Button></form>
                  : <span className="min-w-0 flex-1">{k.text}</span>}
                {k.ok && fixing !== k.id && !me.interview && <span className="flex gap-1"><button onClick={() => setFixing(k.id)} className="inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs"><Pencil className="size-3" />Fix</button><button onClick={() => drop(k.id)} className="h-7 rounded-full border px-2 text-xs">Not me</button></span>}
              </div>
            ))}
          </div>
        )
      }
      case "summary": return (
        <div className={box}>
          <span className="text-xs text-[var(--text-muted)]">What your manager will see</span>
          <p className="text-sm leading-relaxed">{summaryOf(heard.filter((k) => k.ok)) || "No details to share."}</p>
          {me.interview ? <Done t="Approved. Audio deleted." /> : <Button className="w-fit rounded-[10px]" onClick={approve}><Check />Approve</Button>}
        </div>
      )
      case "done": return (
        <div className={box}>
          <p className="text-sm text-[var(--text-secondary)]">In your space you&apos;ll see what Shadow finds in your work, and you can check each finding, change your allowlist, set your hours and see exactly what your manager sees. I&apos;ll show you around.</p>
          <Button className="w-fit rounded-[10px]" onClick={openSpace}>Open my space</Button>
        </div>
      )
      case "subhan": return <div className={box}><Button size="sm" variant="outline" className="w-fit rounded-[10px]" onClick={() => toSubhan(m.ask!, m.id)}>Send it to Subhan</Button></div>
      default: return null
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--page)]">
      {/* Soft shapes drift behind the chat and change colour with each step, as in the CI onboarding. */}
      <div aria-hidden className="join-bg pointer-events-none absolute inset-0" style={{ ["--hue" as string]: HUE[stage] }}>
        <span className="join-blob left-[-10%] top-[-15%] size-[55vmax]" />
        <span className="join-blob right-[-15%] bottom-[-20%] size-[50vmax] [animation-delay:-8s]" />
      </div>

      <header className="relative z-10 flex flex-wrap items-center gap-3 px-5 py-4">
        <span aria-hidden className="grid size-8 place-items-center rounded-[10px] bg-[var(--graphite)]"><span className="size-2.5 rounded-full bg-[var(--bronze-dark)]" /></span>
        <span className="flex flex-col leading-tight"><span className="text-sm font-semibold">Shadow setup</span><span className="text-xs text-[var(--text-muted)]">{c.name} · {me.name}</span></span>
        <span className="ml-auto rounded-full bg-white/70 px-2.5 py-1 text-xs text-[var(--text-muted)]">Prototype: what a team member sees from the invite link</span>
        <Link href={`/client/${c.id}?role=Member`} className="text-xs text-[var(--text-muted)] underline">Skip to the portal</Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 pb-48 pt-4" aria-live="polite">
        {log.map((m) => m.who === "you"
          ? <div key={m.id} className="join-in ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[var(--graphite)] px-4 py-2.5 text-sm text-white">{m.text}</div>
          : (
            <div key={m.id} className="join-in flex gap-3">
              <Ring />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="text-[15px] leading-relaxed">{m.text}</p>
                {m.card && cardFor(m)}
              </div>
            </div>
          ))}
        {listening && <div className="join-in ml-auto flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-2.5 text-sm"><Mic className="size-4 text-[var(--delta-bad)]" />Listening<span className="join-dots" /></div>}
        <div ref={end} />
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-[var(--page)]/90 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">{(inInterview ? [] : CHIPS[stage]).map((id) => <button key={id} onClick={() => ask(faq(id).q)} className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-[var(--surface-2)]">{faq(id).q}</button>)}</div>
          <form className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 pl-4" onSubmit={(e) => { e.preventDefault(); if (inInterview) { if (text.trim()) { answer(text.trim()); setText("") } } else ask(text) }}>
            {inInterview && <button type="button" onClick={() => answer()} disabled={listening} className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--delta-bad)] text-white disabled:opacity-50" aria-label="Answer by voice"><Mic className="size-4" /></button>}
            <input id="join-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={inInterview ? "Tap the mic to answer, or type here" : "Ask me anything, or say where you're stuck"} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button type="submit" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--graphite)] text-white" aria-label="Send"><ArrowUp className="size-4" /></button>
          </form>
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]"><span className="h-1 w-28 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-1 rounded-full bg-[var(--bronze)] transition-all" style={{ width: `${pct}%` }} /></span>{done} of {steps.length} done · answers come from what Subhan approved</div>
        </div>
      </footer>

      <style>{`
        .join-bg .join-blob { position:absolute; border-radius:9999px; background: radial-gradient(circle at 50% 50%, var(--hue), transparent 65%); filter: blur(40px); opacity:.55; transition: background 1.2s ease; animation: joinDrift 24s ease-in-out infinite alternate; }
        @keyframes joinDrift { from { transform: translate(0,0) scale(1) } to { transform: translate(6%,4%) scale(1.08) } }
        .join-in { animation: joinIn .35s ease-out both }
        @keyframes joinIn { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform:none } }
        .join-ring { animation: joinSpin 9s linear infinite }
        @keyframes joinSpin { to { transform: rotate(360deg) } }
        .join-dots::after { content:"..."; animation: joinBlink 1.2s steps(4) infinite; }
        @keyframes joinBlink { 0% { content:"" } 33% { content:"." } 66% { content:".." } 100% { content:"..." } }
        @media (prefers-reduced-motion: reduce) { .join-bg .join-blob, .join-ring, .join-in { animation: none } }
      `}</style>
    </div>
  )
}

function Ring() {
  return (
    <span aria-hidden className="join-ring relative mt-0.5 size-8 shrink-0">
      {Array.from({ length: 8 }, (_, i) => <span key={i} className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-[var(--graphite)]" style={{ transform: `rotate(${i * 45}deg) translate(11px) translate(-50%,-50%)`, opacity: 0.35 + (i / 8) * 0.65 }} />)}
    </span>
  )
}

function Done({ t }: { t: string }) {
  return <span className="flex items-center gap-1.5 text-sm text-[var(--delta-good)]"><CheckCircle2 className="size-4" />{t}</span>
}

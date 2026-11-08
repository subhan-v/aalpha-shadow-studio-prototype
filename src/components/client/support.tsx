"use client"

// Support chat, bottom right on every client page. It answers only from the approved Common
// questions and never reads client data. "Talk to a person" opens a request in Studio.

import { useState } from "react"
import { LifeBuoy, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FAQ } from "@/lib/faq"
import { newRequest } from "@/lib/requests"
import { useStore } from "@/lib/store"
import type { Client, Seat } from "@/lib/types"

const STOP = new Set(["the", "a", "an", "is", "it", "my", "i", "do", "does", "can", "what", "how", "to", "of", "on", "in", "and", "or", "be", "are", "you", "your", "me", "this", "that", "will", "our", "its", "any", "get", "there", "who", "why", "when", "much"])
const words = (x: string) => x.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w))

/** The approved answer whose question shares the most words with the ask, or none. */
export function bestAnswer(q: string) {
  const qw = words(q)
  // Match on the approved question only, so an unrelated ask gets "talk to a person", not a stretch.
  const scored = FAQ.map((f) => ({ f, n: words(f.q).filter((w) => qw.some((x) => w.slice(0, 5) === x.slice(0, 5))).length })).sort((a, b) => b.n - a.n)
  return scored[0]?.n >= 1 ? scored[0].f : null
}

export function SupportChat({ c, me }: { c: Client; me: Seat }) {
  const { mutate } = useStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [log, setLog] = useState<{ who: "you" | "bot"; text: string }[]>([{ who: "bot", text: "Hi, I can answer common questions about Shadow. For anything else, ask a person." }])
  const [sent, setSent] = useState(false)
  const ask = () => {
    const text = q.trim()
    if (!text) return
    const f = bestAnswer(text)
    setLog((l) => [...l, { who: "you", text }, { who: "bot", text: f ? f.a : "I don't have an approved answer for that. Tap \"Talk to a person\" and Subhan will reply." }])
    setQ("")
  }
  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div role="dialog" aria-label="Support" className="flex w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3"><span className="font-semibold">Help</span><Button size="icon-sm" variant="ghost" aria-label="Close help" onClick={() => setOpen(false)}><X /></Button></div>
          <div className="flex max-h-72 flex-col gap-2 overflow-auto p-4 text-sm">
            {log.map((m, i) => <span key={i} className={m.who === "you" ? "max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--graphite)] px-3 py-2 text-white" : "max-w-[90%] self-start rounded-2xl rounded-bl-md bg-[var(--surface-2)] px-3 py-2"}>{m.text}</span>)}
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); ask() }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Can I pause it?" aria-label="Your question" className="h-9 flex-1 rounded-xl" />
            <Button type="submit" size="icon" aria-label="Ask" className="size-9 rounded-xl"><Send /></Button>
          </form>
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-[var(--text-muted)]">
            <span>Answers come from approved help only.</span>
            <button disabled={sent} className="font-medium text-[var(--bronze)] hover:underline disabled:text-[var(--text-muted)]" onClick={() => {
              const last = [...log].reverse().find((m) => m.who === "you")?.text ?? "Needs help with Shadow"
              mutate((p) => newRequest(p, { clientId: c.id, from: `${me.name} (${c.name})`, source: "Client app", kind: /broken|bug|wrong|error|not working|doesn.t work|crash|stuck/i.test(last) ? "Bug" : "Question", title: last.slice(0, 80), detail: "From the help chat.", priority: "Normal", assignee: c.owner }))
              setLog((l) => [...l, { who: "bot", text: "Done. Subhan will reply here and in Slack." }])
              setSent(true)
            }}>{sent ? "Sent to Subhan" : "Talk to a person"}</button>
          </div>
        </div>
      )}
      <Button aria-label={open ? "Close help" : "Open help"} onClick={() => setOpen(!open)} className="size-12 rounded-full shadow-lg"><LifeBuoy className="size-5" /></Button>
    </div>
  )
}

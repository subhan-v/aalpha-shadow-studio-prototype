"use client"

// After setup, the guide walks a member through their space once (v19.3): what we found and how
// to correct it, their allowlist, suggesting additions, their hours, what their manager sees,
// and where to get help. Dismissed for good with "Got it"; reopened from the footer link.

import { useState } from "react"
import { ArrowLeft, ArrowRight, Bot, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import type { Client, Seat } from "@/lib/types"
import { APP } from "@/lib/flags"

export function MemberTour({ c, me, go }: { c: Client; me: Seat; go: (tab: string) => void }) {
  const { update } = useStore()
  const [i, setI] = useState(0)
  const canBlock = c.capture.membersCanBlock
  const stops: { title: string; body: string; show?: string }[] = [
    { title: "This is your space", body: `Only you see My work. It shows your time and the repeat work ${APP} found in it. Hours only, never dollars.` },
    { title: "Check what we found", body: "Each finding has That's right and Not quite. If something is off, say so and Subhan fixes it before anyone acts on it." },
    { title: "Your allowlist", body: canBlock ? `Take apps or sites off your allowlist any time, and ${APP} skips them for you.` : "Your owner manages the team allowlist. Ask to take something off and Subhan sorts it.", show: "Take things off" },
    { title: "Suggest for the allowlist", body: "Missing a work tool? Suggest it. Your owner decides, and nothing outside the allowlist is captured.", show: "Suggest something" },
    { title: "Your hours", body: "It runs only inside your work hours and stops when your screen locks. Narrow the hours, or pause any time from the menu bar or here.", show: "Change my hours" },
    { title: "What your manager sees", body: "Team totals only. Your own numbers, screenshots, window titles and blocked apps are never shown to anyone else, and nothing here is used for reviews or pay.", show: "See it" },
    { title: "You have support", body: "Ask the guide in the corner any time, or reply to Subhan in Slack. Every question gets an answer from a person if the guide can't help." },
  ]
  const s = stops[i]
  const done = () => update(c.id, (x) => {
    const p = x.prefs[me.id] ?? { pausedUntil: null, start: null, end: null, block: [], allow: [] }
    return { ...x, prefs: { ...x.prefs, [me.id]: { ...p, checklist: Array.from(new Set([...(p.checklist ?? []), "walkthrough"])) } } }
  })

  return (
    <section aria-label="Walkthrough" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--bronze)] bg-[var(--seq-100)] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium"><span className="grid size-7 place-items-center rounded-full bg-[var(--graphite)] text-white"><Bot className="size-4" /></span>Your guide · {i + 1} of {stops.length}</span>
        <button onClick={done} aria-label="Close the walkthrough" className="grid size-8 place-items-center rounded-full hover:bg-white/60"><X className="size-4" /></button>
      </div>
      <h2 className="text-lg">{s.title}</h2>
      <p className="max-w-[65ch] text-sm text-[var(--text-secondary)]">{s.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        {i > 0 && <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => setI(i - 1)}><ArrowLeft />Back</Button>}
        {s.show && <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => go("settings")}>{s.show}</Button>}
        {i < stops.length - 1
          ? <Button size="sm" className="rounded-[10px]" onClick={() => setI(i + 1)}>Next<ArrowRight /></Button>
          : <Button size="sm" className="rounded-[10px]" onClick={done}>Got it</Button>}
      </div>
    </section>
  )
}

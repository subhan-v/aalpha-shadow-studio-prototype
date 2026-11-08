"use client"

// Studio > Interviews: the question sets for the 5-minute voice interview, one per kind of
// role. Edits apply to every client's next interviews. Plus who has done theirs.

import { useState } from "react"
import { Plus, RotateCcw, Trash2 } from "lucide-react"
import { Kpi, PageHeader, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { INTERVIEW_SETS, questionsFor, SET_LABEL } from "@/lib/setup"
import { useStore } from "@/lib/store"
import type { InterviewSet } from "@/lib/types"
import { cn } from "@/lib/utils"

const SETS = Object.keys(INTERVIEW_SETS) as InterviewSet[]

export default function Interviews() {
  const { s, mutate } = useStore()
  const [set, setSet] = useState<InterviewSet>("Executive")
  const qs = questionsFor(s, set)
  const save = (next: string[]) => mutate((p) => ({ ...p, interviewSets: { ...(p.interviewSets ?? {}), [set]: next } }))
  const seats = s.clients.flatMap((c) => c.seats.filter((x) => !x.away))
  const done = seats.filter((x) => x.interview).length
  return (
    <>
      <PageHeader title="Interviews" sub="Five questions, about five minutes, by voice, picked for each person's role. Audio is deleted after processing; the transcript and summary are kept." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi label="Interviews done" value={`${done} of ${seats.length}`} note="Across every client" />
        {s.clients.filter((c) => c.seats.some((x) => x.interview)).map((c) => <Kpi key={c.id} label={c.name} value={`${c.seats.filter((x) => x.interview).length} of ${c.seats.length}`} note="Approved by the person" />)}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Question set">
        {SETS.map((k) => <button key={k} aria-pressed={set === k} onClick={() => setSet(k)} className={cn("h-9 rounded-full border px-3.5 text-sm", set === k ? "border-[var(--graphite)] bg-[var(--graphite)] text-white" : "bg-card text-[var(--text-secondary)]")}>{SET_LABEL[k]}</button>)}
      </div>
      <Section title={SET_LABEL[set]} sub="Keep it to about five. Each one should take a minute to answer." right={<Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => save(INTERVIEW_SETS[set])}><RotateCcw />Reset</Button>}>
        <ol className="flex flex-col gap-2">
          {qs.map((q, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 text-sm text-[var(--text-muted)]">{i + 1}</span>
              <Input value={q} onChange={(e) => save(qs.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Question ${i + 1}`} className="h-10 flex-1 rounded-[10px]" />
              <Button size="icon-sm" variant="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => save(qs.filter((_, j) => j !== i))}><Trash2 /></Button>
            </li>
          ))}
        </ol>
        <Button size="sm" variant="outline" className="mt-3 rounded-[10px]" disabled={qs.length >= 7} onClick={() => save([...qs, "New question"])}><Plus />Add a question</Button>
        {qs.length > 5 && <p className="mt-2 text-xs text-[var(--watch-fg)]">More than five questions runs past five minutes.</p>}
      </Section>
    </>
  )
}

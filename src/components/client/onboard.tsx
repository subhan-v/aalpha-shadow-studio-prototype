"use client"

// Get started: the required setup for each role. Until it is done, the rest of the app waits.
// Everyone signs in with Slack, installs, turns on the Mac permissions and does the 5-minute
// interview; owners, managers and members each have a few steps of their own.

import { CheckCircle2, Circle, Download, ExternalLink, FileSignature, Lock } from "lucide-react"
import { Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { CONSENT_POINTS, onboardingSteps, surveyLink } from "@/lib/setup"
import { agree as agreeTo, hasConsent } from "@/lib/consent"
import { fmt } from "@/lib/dates"
import { useStore } from "@/lib/store"
import type { Client, Role, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APP } from "@/lib/flags"

export function GetStarted({ c, me, role, go }: { c: Client; me: Seat; role: Role; go: (tab: string) => void }) {
  const { s, update } = useStore()
  const steps = onboardingSteps(c, me, role, s.today)
  const n = steps.filter((x) => x.done).length
  const open = !!c.prefs[me.id]?.checklist?.includes("complete")
  // Prototype stand-ins for what happens outside the app: the installer, the Mac settings, the survey.
  const seat = (fn: (y: Seat, t: string) => Seat, text: string) => update(c.id, (x, t) => ({ ...x, seats: x.seats.map((y) => (y.id === me.id ? fn(y, t) : y)), log: [{ date: t, text: `${me.name} ${text}.` }, ...x.log] }))
  const tick = (k: string) => update(c.id, (x, t) => {
    const p = x.prefs[me.id] ?? { pausedUntil: null, start: null, end: null, block: [], allow: [] }
    const list = p.checklist ?? []
    const next = list.includes(k) ? list : [...list, k]
    // Finishing the last step unlocks the app for good, even if a setting changes later.
    const finished = onboardingSteps({ ...x, prefs: { ...x.prefs, [me.id]: { ...p, checklist: next } } }, me, role, t).every((y) => y.done)
    return { ...x, prefs: { ...x.prefs, [me.id]: { ...p, checklist: finished && !next.includes("complete") ? [...next, "complete"] : next } }, log: finished ? [{ date: t, text: `${me.name} finished setup.` }, ...x.log] : x.log }
  })
  const agree = () => update(c.id, (x, t) => ({ ...x, seats: x.seats.map((y) => (y.id === me.id ? agreeTo(x, y, t) : y)), log: [{ date: t, text: `${me.name} agreed to ${x.consentVersion ?? "the consent form"}.` }, ...x.log] }))
  const signIn = () => update(c.id, (x, t) => ({ ...x, seats: x.seats.map((y) => (y.id === me.id ? { ...y, slack: { handle: me.name.toLowerCase().replace(/[^a-z]+/g, "."), display: me.name, email: `${me.name.split(" ")[0].toLowerCase()}@${x.slackSlug}.com`, hue: 210 } } : y)), log: [{ date: t, text: `${me.name} signed in with Slack.` }, ...x.log] }))
  return (
    <div data-tour="getstarted" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border bg-card p-5">
        <span className="flex items-baseline justify-between gap-2"><span className="font-semibold">{n} of {steps.length} done</span><span className="text-xs text-[var(--text-muted)]">{role} setup</span></span>
        <span className="h-2 rounded-full bg-[var(--surface-2)]"><span className="block h-2 rounded-full bg-[var(--status-good)]" style={{ width: `${(n / steps.length) * 100}%` }} /></span>
        {n < steps.length && (open
          ? <span className="text-xs text-[var(--text-muted)]">{APP} is open for you. Finish the rest when you can.</span>
          : <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Lock className="size-3.5" />The rest of {APP} opens once these are done.</span>)}
      </div>
      {role === "Owner" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
          <FileSignature className="size-4 text-[var(--text-muted)]" />
          <span className="flex-1">{c.contract ? <>Agreement signed by {c.contract.signer} on {fmt(c.contract.signed)} · {c.contract.version}</> : "Agreement not signed yet. Aalpha sends it before kickoff."}</span>
          {c.contract && <span className="text-xs text-[var(--text-muted)]">The signed copy lives in the e-signature tool.</span>}
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {steps.map((x, i) => (
          <li key={x.k} className="flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-4">
            {x.done ? <CheckCircle2 className="mt-0.5 size-5 text-[var(--status-good)]" /> : <Circle className="mt-0.5 size-5 text-[var(--text-muted)]" />}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn("text-sm font-medium", x.done && "text-[var(--text-secondary)]")}>{i + 1}. {x.name}</span>
              <span className="text-sm text-[var(--text-secondary)]">{x.body}{x.auto && <span className="text-xs text-[var(--text-muted)]"> · ticks itself</span>}</span>
            </span>
            {!x.done && x.k === "consent" && (
              <div className="flex w-full flex-col gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-sm sm:ml-8">
                <span className="text-xs text-[var(--text-muted)]">{c.consentVersion ?? "Consent form v1.0"}, in short</span>
                <ul className="flex list-disc flex-col gap-1 pl-5">{CONSENT_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
                <span className="flex flex-wrap items-center gap-3">
                  <Button size="sm" className="rounded-[10px]" onClick={agree}>I agree</Button>
                  <button onClick={() => go("how")} className="text-xs font-medium text-[var(--bronze)] hover:underline">Read how {APP} works</button>
                  <span className="text-xs text-[var(--text-muted)]">We save who agreed, when and to which version.</span>
                </span>
              </div>
            )}
            {!x.done && x.k === "slackscope" && <Button size="sm" className="rounded-[10px]" onClick={() => update(c.id, (y, t) => ({ ...y, connections: { ...y.connections, slackDisclosure: { by: me.name, at: t } }, log: [{ date: t, text: `${me.name} confirmed what ${APP} reads in Slack.` }, ...y.log] }))}>I understand</Button>}
            {!x.done && x.k === "slack" && <Button size="sm" className="rounded-[10px] bg-[#4a154b] hover:bg-[#4a154b]/90" onClick={signIn}>Sign in with Slack</Button>}
            {!x.done && x.k === "install" && hasConsent(c, me) && <Button size="sm" className="rounded-[10px]" title={`In the prototype this marks ${APP} as installed`} onClick={() => seat((y, t) => ({ ...y, installAt: t, permissions: false }), `installed ${APP}`)}><Download />Download for Mac</Button>}
            {!x.done && x.k === "install" && !hasConsent(c, me) && <span className="text-xs text-[var(--text-muted)]">Agree to the consent form first.</span>}
            {!x.done && x.k === "perms" && me.installAt && <Button size="sm" variant="outline" className="rounded-[10px]" title="In the prototype this marks the permissions as on" onClick={() => seat((y) => ({ ...y, permissions: true }), "turned on the Mac permissions")}>I&apos;ve turned them on</Button>}
            {!x.done && x.k === "ci" && <span className="flex flex-wrap gap-2"><a href={surveyLink(c)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-[10px] border px-3 text-sm font-medium">Take the survey<ExternalLink className="size-3.5" /></a><Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => seat((y) => ({ ...y, ciSurvey: true }), "finished the Culture Intelligence survey")}>I&apos;ve finished it</Button></span>}
            {!x.done && x.tab && <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => go(x.tab!)}>{x.k === "interview" ? "Start interview" : "Open"}</Button>}
            {!x.done && !x.auto && x.k !== "consent" && x.k !== "interview" && x.k !== "slackscope" && <Button size="sm" variant="ghost" className="rounded-[10px]" onClick={() => tick(x.k)}>Mark done</Button>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Shown in place of a tab while setup is unfinished. */
export function Gate({ go }: { go: (tab: string) => void }) {
  return (
    <Section title="Finish setting up first" sub={`${APP} opens once your Get started steps are done`}>
      <Button className="rounded-[10px]" onClick={() => go("getstarted")}>Go to Get started</Button>
    </Section>
  )
}

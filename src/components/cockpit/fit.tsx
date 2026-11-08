"use client"

import { Link2, RefreshCw, Send, Upload } from "lucide-react"
import { Kpi, Pill, Section } from "@/components/bits"
import { FitChart } from "@/components/fit-chart"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmt } from "@/lib/dates"
import { makeFit } from "@/lib/delivery"
import { surveyLink } from "@/lib/setup"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"

export function FitTab({ c }: { c: Client }) {
  const { update } = useStore()
  const done = c.seats.filter((s) => s.ciSurvey).length
  const seat = (id: string) => c.seats.find((s) => s.id === id)!
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Kpi label="Survey done" value={`${done}/${c.seats.length}`} note="Culture Intelligence survey" t={done < c.seats.length ? "warn" : undefined} />
        <Kpi label="Last sync" value={c.ci.lastSync ? fmt(c.ci.lastSync) : "Not yet"} note={c.ci.connected ? "Culture Intelligence, new members sync in" : "Not connected"} />
        <Kpi label="Key-person risk" value={c.fit.filter((f) => f.keyPerson).length} note="People the team leans on most" />
        <Kpi label="Client can see it" value={c.fitPublished ? "Yes" : "No"} note={c.fitPublished ? "Published" : "Publish when it is ready"} />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
        <span className="flex min-w-0 flex-1 flex-col"><span className="font-medium">Survey link for {c.name}</span><a href={surveyLink(c)} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-[var(--bronze)] hover:underline">{surveyLink(c)}</a><span className="text-xs text-[var(--text-muted)]">Created in Aalpha&apos;s Culture Intelligence account, unique to this client. {c.ci.postedTo ? `Posted to ${c.ci.postedTo}.` : "Not posted yet."} {done} of {c.seats.length} done.</span></span>
        {!c.ci.postedTo && <Button size="sm" className="rounded-[10px]" onClick={() => update(c.id, (x, t) => ({ ...x, ci: { ...x.ci, surveyLink: surveyLink(x), postedTo: `#${x.slackSlug}-shadow`, invitesSent: t }, log: [{ date: t, text: `Culture Intelligence survey link posted to #${x.slackSlug}-shadow.` }, ...x.log] }))}><Send />Post to their Slack channel</Button>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
        <span className="flex items-center gap-2.5 text-sm">
          <span className="grid size-8 place-items-center rounded-full bg-[var(--seq-100)] text-[var(--bronze)]"><Link2 className="size-4" /></span>
          <span className="flex flex-col"><span className="font-medium">{c.ci.connected ? "Connected to Culture Intelligence" : "Culture Intelligence not connected"}</span><span className="text-xs text-[var(--text-muted)]">{c.ci.connected ? `Built once from the survey; new members sync in${c.ci.invitesSent ? ` · invites sent ${fmt(c.ci.invitesSent)}` : ""}` : "Connect to send the survey and sync results"}</span></span>
        </span>
        <span className="flex flex-wrap gap-2">
          {c.ci.connected ? (
            <>
              <Button size="sm" variant="outline" className="rounded-[10px]" disabled={done === c.seats.length} onClick={() => update(c.id, (x, t) => ({ ...x, ci: { ...x.ci, invitesSent: t }, log: [{ date: t, text: `Culture Intelligence survey sent to ${x.seats.filter((s) => !s.ciSurvey).length} people.` }, ...x.log] }))}><Send />Send survey to {c.seats.length - done}</Button>
              <Button size="sm" className="rounded-[10px]" onClick={() => update(c.id, (x, t) => { const y = { ...x, seats: x.seats.map((s, i) => (x.ci.invitesSent && i % 4 !== 3 ? { ...s, ciSurvey: true } : s)) }; return { ...y, fit: makeFit(y), fitImported: t, ci: { ...x.ci, lastSync: t }, log: [{ date: t, text: `Synced from Culture Intelligence (${y.seats.filter((s) => s.ciSurvey).length} results).` }, ...x.log] } })}><RefreshCw />Sync now</Button>
            </>
          ) : <Button size="sm" className="rounded-[10px]" onClick={() => update(c.id, (x, t) => ({ ...x, ci: { ...x.ci, connected: true }, log: [{ date: t, text: "Culture Intelligence connected." }, ...x.log] }))}><Link2 />Connect</Button>}
        </span>
      </div>
      <Section title="Team Fit Map" sub="Synced from Culture Intelligence. Check the teams and leads, then publish."
        right={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => update(c.id, (x, t) => ({ ...x, fit: makeFit(x), fitImported: t, log: [{ date: t, text: `Culture Intelligence results imported (${x.seats.filter((s) => s.ciSurvey).length} people).` }, ...x.log] }))}><Upload />{c.fitImported ? "Rebuild map" : "Build map"}</Button>
            <Button size="sm" className="rounded-[10px]" disabled={!c.fitImported} onClick={() => update(c.id, (x, t) => ({ ...x, fitPublished: !x.fitPublished, log: [{ date: t, text: x.fitPublished ? "Fit Map unpublished." : "Team Fit Map published to the client." }, ...x.log] }))}>{c.fitPublished ? "Unpublish" : "Publish to client"}</Button>
          </div>
        }>
        {c.fitImported ? <FitChart c={c} /> : <p className="py-6 text-center text-sm text-[var(--text-muted)]">Import the survey results to build the map. {done} of {c.seats.length} people have taken the survey.</p>}
      </Section>
      {c.fitImported && (
        <Section title="People" sub="Correct teams or key-person flags before publishing">
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Team</TableHead><TableHead>Profile</TableHead><TableHead className="text-right">Role fit</TableHead><TableHead className="text-right">Load</TableHead><TableHead>Key person</TableHead></TableRow></TableHeader>
              <TableBody>
                {c.fit.map((f) => (
                  <TableRow key={f.seatId}>
                    <TableCell className="font-medium">{seat(f.seatId).name}<span className="ml-2 text-xs text-[var(--text-muted)]">{seat(f.seatId).role}</span></TableCell>
                    <TableCell className="text-[var(--text-secondary)]">{f.team}{!f.reportsTo && <span className="ml-1.5 text-xs">(lead)</span>}</TableCell>
                    <TableCell>{f.profile ? <Pill t="info">{f.profile}</Pill> : <Pill t="muted">No survey</Pill>}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.fit ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.loadHrs}h/wk</TableCell>
                    <TableCell><Switch checked={f.keyPerson} onCheckedChange={(v) => update(c.id, (x) => ({ ...x, fit: x.fit.map((y) => (y.seatId === f.seatId ? { ...y, keyPerson: !!v } : y)) }))} aria-label="Key person" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
    </div>
  )
}

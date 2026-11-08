// The client Workbook: everything the client owns, in one versioned export with
// stable IDs so it imports cleanly elsewhere (Notion, Google Docs, another system).

import { goalProgress, WK_TO_MO } from "./client-data"
import { TOOL_NAME } from "./delivery"
import { agentStatus, dayN, guarantees, visibleWorkflows } from "./engine"
import type { Client, ISODate } from "./types"

export const WORKBOOK_SCHEMA = "aalpha.workbook/v1"

export function workbookJson(c: Client, today: ISODate) {
  const g = guarantees(c, today)
  const seat = (id: string) => c.seats.find((s) => s.id === id)
  return {
    schema: WORKBOOK_SCHEMA,
    exportedAt: today,
    client: { id: c.id, name: c.name, day: dayN(c, today) },
    goals: c.goals.filter((x) => x.status === "published").map((x) => ({ id: x.id, title: x.title, metric: x.metric, target: x.target, categories: x.categories, foundHoursWk: Math.round(goalProgress(c, x, today).found * 10) / 10 })),
    workflows: visibleWorkflows(c, today).map((w) => ({ id: w.id, name: w.name, category: w.category, return: w.tier, hoursBackPerWeek: w.hoursWk, people: w.people, tools: w.tools.map((t) => TOOL_NAME[t]) })),
    playbook: c.sops.filter((x) => x.status === "published").map((x) => ({
      id: x.id, title: x.title, owner: x.owner, version: x.version, checked: x.checked,
      sections: x.sections.map((sec) => ({ name: sec.name, role: sec.role, steps: sec.steps.map((st) => ({ id: st.id, tool: TOOL_NAME[st.tool], text: `${st.before} "${st.label}" ${st.after}`.trim(), minutes: st.mins, automatable: st.auto })) })),
    })),
    fitMap: c.fitPublished ? c.fit.map((f) => ({ name: seat(f.seatId)?.name, role: seat(f.seatId)?.role, team: f.team, profile: f.profile, roleFit: f.fit, hoursPerWeek: f.loadHrs, keyPerson: f.keyPerson })) : [],
    automations: c.agents.filter((a) => agentStatus(a, c, today) === "live").map((a) => ({ id: a.id, name: a.name, baselineHoursWk: a.baselineHrsWk, savedHoursWk: Math.round(a.baselineHrsWk * a.savesPct * 10) / 10 })),
    scorecard: { hoursFoundWk: g.found, hoursBackWk: g.back, projectedDay90: g.proj, guaranteeDay30: g.d30, guaranteeDay90: g.d90 },
  }
}

export function workbookMarkdown(c: Client, today: ISODate): string {
  const j = workbookJson(c, today)
  const L: string[] = []
  L.push(`# ${c.name} Workbook`, "", `Exported ${today} · day ${j.client.day ?? 0} of 90 · ${WORKBOOK_SCHEMA}`, "")
  L.push("## Scorecard", "", `- Hours found a week: ${j.scorecard.hoursFoundWk}`, `- Hours back a week: ${j.scorecard.hoursBackWk} (target 40)`, `- Projected at day 90: ${j.scorecard.projectedDay90}`, "")
  L.push("## Goals", "")
  for (const g of j.goals) L.push(`- **${g.title}**: ${g.foundHoursWk} of ${g.target} hours a week found`)
  L.push("", "## Ops Playbook", "")
  for (const s of j.playbook) {
    L.push(`### ${s.title}`, "", `Owner ${s.owner} · v${s.version}${s.checked ? ` · checked ${s.checked}` : ""}`, "")
    let n = 0
    for (const sec of s.sections) {
      L.push(`**${sec.name}** (${sec.role})`, "")
      for (const st of sec.steps) L.push(`${++n}. [${st.tool}] ${st.text} (${st.minutes} min${st.automatable ? ", can be automated" : ""})`)
      L.push("")
    }
  }
  L.push("## Team Fit Map", "")
  if (!j.fitMap.length) L.push("Not published yet.")
  for (const f of j.fitMap) L.push(`- ${f.name}, ${f.role} (${f.team}): ${f.profile ?? "no survey"}, fit ${f.roleFit ?? "-"}, ${f.hoursPerWeek} h/wk${f.keyPerson ? ", key person" : ""}`)
  L.push("", "## Automations", "")
  for (const a of j.automations) L.push(`- ${a.name}: saves ${a.savedHoursWk} h/wk`)
  L.push("", "## Workflows", "", "| Workflow | Category | Return | Hours back / mo |", "|---|---|---|---|")
  for (const w of j.workflows) L.push(`| ${w.name} | ${w.category} | ${w.return} | ${Math.round(w.hoursBackPerWeek * WK_TO_MO)} |`)
  return L.join("\n") + "\n"
}

export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

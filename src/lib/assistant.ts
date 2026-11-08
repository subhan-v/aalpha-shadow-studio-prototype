// Ask Studio: answers plain questions from what the Studio already knows (clients, actions,
// alerts, requests, costs) and the delivery library. Every answer names its sources.
// Prototype: rule-based, no model call. The real build puts a model behind the same
// sources, scoped per client, and stays internal until it passes the rollout gates.

import { actions, alerts, assignee, dayN, guarantees, risk, seatStats, stage, STAGES } from "./engine"
import { LIBRARY } from "./library"
import { canMoney } from "./access"
import { OPEN } from "./requests"
import type { State } from "./types"

export type Answer = { lines: string[]; sources: { label: string; href: string }[]; next: string[] }

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x))

/** Starter questions. The client one names a client the person actually works on. */
export const suggested = (s: State) => [
  "Which clients are at risk?",
  "What should I do this week?",
  ...(s.clients[0] ? [`How is ${s.clients.find((c) => c.id === "trivium")?.name.split(" ")[0] ?? s.clients[0].name.split(" ")[0]} doing?`] : []),
  "Any silent computers?",
  "What's waiting on the dev team?",
  "How do I install Viktor?",
  ...(canMoney(s) ? ["What does AI cost us per client?"] : []),
]

export function answer(s: State, raw: string): Answer {
  const q = raw.toLowerCase().trim()
  const t = s.today

  const client = s.clients.find((c) => q.includes(c.name.toLowerCase().split(" ")[0]))
  if (client && !has(q, "how do", "how to")) {
    const g = guarantees(client, t)
    const r = risk(client, t)
    const acts = actions(client, t)
    const reqs = s.requests.filter((x) => x.clientId === client.id && OPEN.includes(x.status))
    const st = seatStats(client, t)
    const n = dayN(client, t)
    return {
      lines: [
        `${client.name} is in ${STAGES.find((x) => x.id === stage(client, t))!.name.toLowerCase()}${n !== null ? `, day ${n} of 90` : ", not started yet"}.`,
        `${st.installed} of ${st.scope} computers recording. ${g.found} hours a week found, ${g.back} handed to agents.`,
        `Day 30 is ${g.d30.replace("_", " ")}, day 90 is ${g.d90.replace("_", " ")}.`,
        r.length ? `Watch: ${r.join("; ")}.` : "Nothing flagged as a risk.",
        `${acts.length} open ${acts.length === 1 ? "action" : "actions"} and ${reqs.length} open ${reqs.length === 1 ? "request" : "requests"}.`,
      ],
      sources: [{ label: `${client.name} cockpit`, href: `/clients/${client.id}` }, { label: "Results", href: `/clients/${client.id}?tab=results` }],
      next: [`What should I do for ${client.name}?`, "Which clients are at risk?"],
    }
  }

  if (has(q, "risk", "behind", "trouble", "worried", "slipping")) {
    const at = s.clients.map((c) => ({ c, r: risk(c, t) })).filter((x) => x.r.length)
    return {
      lines: at.length ? [`${at.length} of ${s.clients.length} clients need attention:`, ...at.map((x) => `${x.c.name}: ${x.r.join("; ")}.`)] : ["No client is flagged right now."],
      sources: [{ label: "Clients", href: "/" }, ...at.slice(0, 3).map((x) => ({ label: x.c.name, href: `/clients/${x.c.id}` }))],
      next: at[0] ? [`How is ${at[0].c.name} doing?`, "What should I do this week?"] : ["What should I do this week?"],
    }
  }

  if (has(q, "my week", "this week", "should i do", "to do", "todo", "my tasks", "today")) {
    const mine = s.clients.flatMap((c) => actions(c, t)).filter((a) => assignee(s, a) === s.me).sort((a, b) => a.due.localeCompare(b.due))
    return {
      lines: mine.length ? [`You have ${mine.length} open ${mine.length === 1 ? "action" : "actions"}. The first five by due date:`, ...mine.slice(0, 5).map((a) => `${a.clientName}: ${a.title} (due ${a.due.slice(5)}).`)] : ["Nothing assigned to you right now."],
      sources: [{ label: "This week", href: "/week" }],
      next: ["Which clients are at risk?", "Any silent computers?"],
    }
  }

  if (has(q, "silent", "computer", "not recording", "offline", "data coming")) {
    const al = alerts(s).filter((a) => a.title.includes("silent") || a.clientId === null)
    return {
      lines: al.length ? al.map((a) => `${a.clientName}: ${a.title}. ${a.detail}`) : ["Every installed computer sent data in the last two working hours."],
      sources: [{ label: "Activity", href: "/monitoring" }, { label: "Alerts", href: "/alerts" }],
      next: ["How do I set up a client's team?", "Which clients are at risk?"],
    }
  }

  if (has(q, "dev team", "linear", "ticket", "request", "bug")) {
    const inLinear = s.requests.filter((r) => r.linear && r.linear.state !== "Done")
    const open = s.requests.filter((r) => OPEN.includes(r.status))
    return {
      lines: [`${open.length} requests are open and ${inLinear.length} are with the dev team.`, ...inLinear.map((r) => `${r.linear!.id} (${r.linear!.state}): ${r.title}.`)],
      sources: [{ label: "Requests", href: "/requests" }],
      next: ["What should I do this week?"],
    }
  }

  if (has(q, "cost", "spend", "credits", "expensive")) {
    if (!canMoney(s)) return { lines: ["AI running costs are for Admins. Ask Subhan if you need a number."], sources: [], next: ["Which clients are at risk?"] }
    const rows = s.clients.map((c) => ({ c, mo: Math.round(seatStats(c, t).active * c.costPerSeatDay * 22) })).sort((a, b) => b.mo - a.mo)
    return {
      lines: [`About $${rows.reduce((n, x) => n + x.mo, 0).toLocaleString()} a month in AI across all clients, at current active computers.`, ...rows.slice(0, 4).map((x) => `${x.c.name}: $${x.mo.toLocaleString()} a month.`)],
      sources: [{ label: "Costs", href: "/costs" }],
      next: ["Which clients are at risk?"],
    }
  }

  const words = q.split(/\W+/).filter((w) => w.length > 2)
  const doc = LIBRARY.map((d) => ({ d, score: words.filter((w) => (d.title + " " + d.tags.join(" ")).toLowerCase().includes(w)).length })).sort((a, b) => b.score - a.score)[0]
  if (doc && doc.score > 0) {
    return {
      lines: [`${doc.d.title}. ${doc.d.when}, owned by the ${doc.d.owner.toLowerCase()}:`, ...doc.d.steps.map((x, i) => `${i + 1}. ${x.text}${x.tip ? ` (${x.tip})` : ""}`)],
      sources: [{ label: `Library: ${doc.d.title}`, href: "/library" }],
      next: LIBRARY.filter((x) => x.id !== doc.d.id).slice(0, 2).map((x) => `How do I ${x.title.charAt(0).toLowerCase()}${x.title.slice(1)}?`),
    }
  }

  return {
    lines: ["I can only answer from what's in the Studio. Try a client's name, risks, your week, silent computers, costs, the dev team, or how to do something from the library."],
    sources: [],
    next: suggested(s).slice(0, 3),
  }
}

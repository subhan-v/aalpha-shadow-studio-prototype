// Agent health: every live agent that may not be meeting spec, across clients. An agent is
// flagged when its success rate drops, people keep stepping in, or someone complained about
// it (in the client app, in Slack, or from our own checks).

import { agentResults } from "./results"
import { churned } from "./renewal"
import type { State } from "./types"

export function agentHealth(s: State) {
  return s.clients.filter((c) => !churned(c, s.today)).flatMap((c) =>
    agentResults(c, s.today).map((x) => {
      const fb = (c.agentFeedback ?? []).filter((f) => f.agentId === x.a.id)
      const open = fb.filter((f) => f.status !== "Resolved")
      const signals = [
        ...(x.success < 90 ? [`Success ${x.success}%`] : []),
        ...(x.runs > 20 && x.interventions / x.runs > 0.15 ? [`Stepped in on ${x.interventions} of ${x.runs} runs`] : []),
        ...(open.length ? [`${open.length} open ${open.length === 1 ? "complaint" : "complaints"}`] : []),
      ]
      return { c, x, fb, open, signals }
    }),
  ).filter((r) => r.signals.length || r.fb.length).sort((a, b) => b.signals.length - a.signals.length)
}

export const openHealth = (s: State) => agentHealth(s).filter((r) => r.signals.length).length

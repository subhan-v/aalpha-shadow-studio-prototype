"use client"

// One store for the whole prototype, saved in this browser only. "Reset demo"
// puts the sample clients back. Nothing here talks to a server. Every change goes
// through one gate: it is checked against the signed-in person's access, then
// written to the audit trail.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { accessOf, denied, scopeState } from "./access"
import { withAudit } from "./audit"
import { addDays } from "./dates"
import { actions, alerts } from "./engine"
import { seed } from "./seed"
import type { Client, ISODate, State } from "./types"

const KEY = "shadow-studio-prototype-v22"

type Store = {
  s: State
  ready: boolean
  shiftDays: (n: number) => void
  runAction: (clientId: string, key: string) => void
  runAlert: (key: string) => void
  snooze: (key: string) => void
  update: (clientId: string, fn: (c: Client, today: ISODate) => Client) => void
  setSim: (patch: Partial<State["sim"]>) => void
  addClient: (c: Client) => void
  reset: () => void
  mutate: (fn: (s: State) => State) => void
  assignClient: (clientId: string, owner: string) => void
  assignAction: (key: string, who: string) => void
  logView: (clientId: string, role: string) => void
  signInAs: (name: string) => void
  notice: string | null
  clearNotice: () => void
}

const Ctx = createContext<Store | null>(null)

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as State
      if (parsed.version === 22) return parsed
    }
  } catch {
    /* private window or blocked storage: fall back to the seed */
  }
  return seed()
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(seed)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Read saved state once on the client; the server always renders the seed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setS(load())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [s, ready])

  // The gate: try the change on the current state first; refuse it with a reason, or apply and audit it.
  const apply = useCallback((fn: (p: State) => State) => {
    const why = denied(s, fn(s))
    const time = new Date().toTimeString().slice(0, 5)
    if (why) {
      // Refused attempts go in the trail too.
      setNotice(why)
      setS((p) => ({ ...p, audit: [{ id: `au${Date.now()}`, at: p.today, time, by: p.me, access: accessOf(p), clientId: null, area: "Refused", text: why }, ...(p.audit ?? [])].slice(0, 2000) }))
      return
    }
    // A change made inside the client app preview is the Studio person acting as a client role; say so.
    const loc = typeof window === "undefined" ? null : window.location
    const via = loc?.pathname.startsWith("/client/") ? `client preview as ${new URLSearchParams(loc.search).get("role") ?? "Owner"}` : null
    setS((p) => withAudit(p, fn(p), time, via))
  }, [s])

  const update = useCallback((clientId: string, fn: (c: Client, today: ISODate) => Client) => {
    apply((p) => ({ ...p, clients: p.clients.map((c) => (c.id === clientId ? fn(c, p.today) : c)) }))
  }, [apply])

  // What the signed-in person may see. Changes are still applied to the full state.
  const view = useMemo(() => scopeState(s), [s])

  const store = useMemo<Store>(
    () => ({
      s: view,
      ready,
      notice,
      clearNotice: () => setNotice(null),
      signInAs: (name) => setS((p) => ({ ...p, me: name })),
      shiftDays: (n) => setS((p) => ({ ...p, today: addDays(p.today, n) })),
      runAction: (clientId, key) =>
        apply((p) => {
          const c = p.clients.find((x) => x.id === clientId)
          if (!c) return p
          const act = actions(c, p.today).find((a) => a.key === key)
          const next = act?.run ? act.run(c, p.today) : { ...c, log: [{ date: p.today, text: `Done: ${act?.title ?? key}` }, ...c.log] }
          return { ...p, clients: p.clients.map((x) => (x.id === clientId ? next : x)), done: { ...p.done, [key]: p.today } }
        }),
      runAlert: (key) =>
        apply((p) => {
          const al = alerts(p).find((a) => a.key === key)
          if (!al) return p
          const clients = al.run && al.clientId ? p.clients.map((x) => (x.id === al.clientId ? al.run!(x, p.today) : x)) : p.clients
          return { ...p, clients, acks: { ...p.acks, [key]: addDays(p.today, 1) } }
        }),
      snooze: (key) => apply((p) => ({ ...p, acks: { ...p.acks, [key]: addDays(p.today, 1) } })),
      update,
      setSim: (patch) => setS((p) => ({ ...p, sim: { ...p.sim, ...patch } })),
      addClient: (c) => apply((p) => ({ ...p, clients: [...p.clients, c] })),
      reset: () => setS(seed()),
      mutate: (fn) => apply(fn),
      assignClient: (clientId, owner) =>
        apply((p) => ({ ...p, clients: p.clients.map((c) => (c.id === clientId ? { ...c, owner, log: [{ date: p.today, text: `Owner changed to ${owner} by ${p.me}.` }, ...c.log] } : c)) })),
      assignAction: (key, who) => apply((p) => ({ ...p, assign: { ...p.assign, [key]: who } })),
      logView: (clientId, role) => setS((p) => ({ ...p, viewLog: [{ at: p.today, who: p.me, clientId, role }, ...p.viewLog].slice(0, 200) })),
    }),
    [view, ready, update, apply, notice],
  )

  // A refused change says why, then gets out of the way.
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(id)
  }, [notice])

  return (
    <Ctx.Provider value={store}>
      {children}
      {notice && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-xl bg-[var(--graphite)] px-4 py-3 text-sm text-white shadow-lg">
          <span>{notice}</span>
          <button className="text-xs text-white/70 underline-offset-2 hover:underline" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useStore outside StoreProvider")
  return v
}

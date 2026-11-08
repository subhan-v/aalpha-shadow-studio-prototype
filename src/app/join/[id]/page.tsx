"use client"

// The invite link (shadow.so/i/<client>) lands here: the member's setup as one conversation.

import Link from "next/link"
import { useParams } from "next/navigation"
import { JoinChat } from "@/components/join-chat"
import { useStore } from "@/lib/store"

export default function JoinPage() {
  const { id } = useParams<{ id: string }>()
  const { s } = useStore()
  const c = s.clients.find((x) => x.id === id)
  if (!c) return <p className="p-6">This invite link isn&apos;t valid. <Link className="underline" href="/">Back to Studio</Link></p>
  // The same team member the portal's Member view uses.
  const me = c.seats[Math.min(3, c.seats.length - 1)]
  return <JoinChat key={me.id} c={c} me={me} />
}

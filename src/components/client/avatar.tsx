"use client"

// A person as Slack shows them: photo (initials here), display name and handle.

import { initials, slackOf } from "@/lib/setup"
import type { Client, Seat } from "@/lib/types"
import { cn } from "@/lib/utils"

export function SlackAvatar({ c, s, size = 32, className }: { c: Client; s: Seat; size?: number; className?: string }) {
  const p = slackOf(c, s)
  return <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-lg font-semibold text-white", className)} style={{ width: size, height: size, fontSize: size * 0.38, background: `oklch(0.58 0.12 ${p.hue})` }}>{initials(s.name)}</span>
}

export function SlackBadge() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#4a154b]/10 px-2 py-0.5 text-xs font-medium text-[#4a154b]"><span className="size-1.5 rounded-full bg-[#4a154b]" />Synced from Slack</span>
}

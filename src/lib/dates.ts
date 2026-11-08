import type { ISODate } from "./types"

const DAY = 86_400_000

export function toDate(d: ISODate): Date {
  return new Date(d + "T00:00:00Z")
}

export function addDays(d: ISODate, n: number): ISODate {
  return new Date(toDate(d).getTime() + n * DAY).toISOString().slice(0, 10)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY)
}

export function fmt(d: ISODate): string {
  return toDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

export function fmtLong(d: ISODate): string {
  return toDate(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
}

export function weekday(d: ISODate): number {
  return toDate(d).getUTCDay() // 0 Sun … 6 Sat
}

/** Monday of the week that contains d. */
export function weekStart(d: ISODate): ISODate {
  const wd = weekday(d)
  return addDays(d, wd === 0 ? -6 : 1 - wd)
}

/** Friday of the week that contains d. */
export function fridayOf(d: ISODate): ISODate {
  return addDays(weekStart(d), 4)
}

/** Small deterministic hash so simulated numbers stay stable for a given day. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

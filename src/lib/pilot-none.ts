// Public demo build: no pilot client and no pilot requests.
import type { Client, ISODate, State } from "./types"

export function pilot(_t: ISODate): Client | null { return null }
export const PILOT_REQUESTS = (_t: ISODate): State["requests"] => []

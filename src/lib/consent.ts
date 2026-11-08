// Consent rules in one place. Consent counts only for the current version of the form, so a new
// version asks everyone again. Kept free of other imports so the engine can use it too.

import type { Client, ISODate, Seat } from "./types"

export const hasConsent = (c: Pick<Client, "consentVersion">, s: Seat) => s.consent && (!c.consentVersion || s.consentVersion === c.consentVersion)
export const needsReconsent = (c: Pick<Client, "consentVersion">, s: Seat) => s.consent && !!c.consentVersion && s.consentVersion !== c.consentVersion

/** Agreeing always stamps the date and the version. */
export const agree = (c: Pick<Client, "consentVersion">, s: Seat, today: ISODate): Seat => ({ ...s, consent: true, consentAt: today, consentVersion: c.consentVersion ?? "Consent form v1.0" })

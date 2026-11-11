// Retention and deletion rules in one place, so the consent form, Your data, Settings, Studio
// and offboarding all state the same periods. Change a number here and every page follows.
// Periods confirmed by Subhan on 2026-11-11: Slack text 30 days, a deletion request within 7 days,
// everything within 30 days of offboarding. Screenshots (7 days) and audio were already stated.
// None of these is built in Shadow yet; the mockup is the spec.

import { addDays } from "./dates"
import type { Client, ISODate, Request } from "./types"

/** A deletion request is carried out within this many days. It cannot be declined. */
export const DELETE_WITHIN_DAYS = 7
/** After a company stops working with us, everything is deleted within this many days. */
export const OFFBOARD_DELETE_DAYS = 30
export const SCREENSHOT_DAYS = 7
export const SLACK_TEXT_DAYS = 30

export type Kept = { what: string; kept: string; note: string }

export const RETENTION: Kept[] = [
  { what: "Screenshots", kept: `${SCREENSHOT_DAYS} days`, note: "Then deleted. Only the steps found in them are kept." },
  { what: "Slack message text", kept: `${SLACK_TEXT_DAYS} days`, note: "Then the text is deleted. Counts and patterns stay, with no wording." },
  { what: "Interview audio", kept: "Until processed", note: "Deleted right after. The summary you approve is kept." },
  { what: "Pay stub files", kept: "Until read", note: "Deleted right after. Only the hourly cost is kept." },
  { what: "Steps of the work", kept: "While we work together", note: "The app, site and action. No screenshots and nothing typed." },
  { what: "Findings and team totals", kept: "While we work together", note: "Workflows, hours and results." },
  { what: "Everything, once we stop working together", kept: `${OFFBOARD_DELETE_DAYS} days`, note: "Then deleted, and the owner gets a confirmation." },
]

export const DELETION_LINE = `You can ask us to delete your data at any time. It is gone within ${DELETE_WITHIN_DAYS} days and the request can't be turned down.`
export const RETENTION_LINE = `Screenshots are deleted after ${SCREENSHOT_DAYS} days and Slack message text after ${SLACK_TEXT_DAYS} days.`

export type DeletionScope = NonNullable<Request["scope"]>

export const SCOPE_LABEL: Record<DeletionScope, string> = { day: "One day", person: "One person, everything", company: "Whole company" }

/** The date a deletion request must be finished by. */
export const deletionDue = (r: Pick<Request, "created">): ISODate => addDays(r.created, DELETE_WITHIN_DAYS)

/** The date an offboarded client's data must be gone by. */
export const offboardDeletionDue = (c: Pick<Client, "offboardedAt" | "deletionDueAt">): ISODate | null =>
  c.deletionDueAt ?? (c.offboardedAt ? addDays(c.offboardedAt, OFFBOARD_DELETE_DAYS) : null)

/** What a person's export holds. Sample shape only: the real build fills it from Shadow. */
export const EXPORT_CONTENTS = ["Your settings and consent record", "The steps of your work", "Screenshots from the last 7 days", "Your Slack messages we still hold", "Your interview summary", "Findings about your work"]

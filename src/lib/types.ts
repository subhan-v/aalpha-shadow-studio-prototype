// Shapes for the Studio prototype. Everything is plain data so it can sit in
// localStorage and be reset to the seed at any time.

export type ISODate = string // yyyy-mm-dd

export type AgentStatus = "proposed" | "approved" | "building" | "qa" | "qa_failing" | "live"

export type Seat = {
  id: string
  name: string
  role: string
  installAt: ISODate | null // planned or actual install day; null = will not install without a nudge
  silentFrom?: ISODate | null // computer stops sending data from this day…
  silentTo?: ISODate | null // …until this day (exclusive). null silentTo = still silent
  consent: boolean
  ciSurvey: boolean
  nudgedAt?: ISODate | null
  consentAt?: ISODate | null // when they agreed to the consent form
  consentVersion?: string | null // which version they agreed to; a new version asks again
  permissions?: boolean // false = installed but the 3 Mac permissions are not all on
  extension?: boolean // the Chrome extension is on their work profile (members, v19.3); unset = not tracked
  exec?: boolean // C-suite: gets the Executive dashboard
  team?: string // function team; every invite names one
  pod?: string // home pod, for agencies organized by pod
  pausedFrom?: ISODate | null // paused by the person; allowed, flagged after 3 working days
  away?: "leave" | "excluded" | null // left out of recording follow-up
  slack?: { handle: string; display: string; email: string; hue: number; admin?: boolean } // synced from Slack sign-in
  interview?: { status: "done" | "approved"; at: ISODate; role: InterviewSet; summary?: string; pains?: string[]; mapped?: { goals: number; workflows: number; handoffs: number; never: number; notes: number } } | null
}

export type InterviewSet = "Executive" | "Operations" | "Delivery" | "Sales"

/** What an Aalpha admin can change on a client's subscription. Every change is logged. */
export type SubSettings = {
  discount?: { pct: number; from?: ISODate; until: ISODate | null; note: string } | null
  credits?: { amount: number; at: ISODate; note: string }[]
  paused?: { from: ISODate; until: ISODate | null; reason: string } | null
  cancelAt?: ISODate | null
  cancelReason?: ChurnReason | null // the same seven reasons as a lost renewal
  cancelNote?: string | null
  billingDay?: number
  history?: { at: ISODate; by: string; text: string }[]
}

/** A tool connected through Composio, scoped to the whole company or chosen teams. */
export type Connector = { id: string; group: string; name: string; on: boolean; by?: string | null; at?: ISODate | null; scope: "company" | string[] }

export type Agent = {
  id: string
  name: string
  baselineHrsWk: number
  plannedLiveDay: number // day N of 90 the plan says it goes live
  savesPct: number // share of the baseline hours it takes back
  blocked?: "qa_failing" | null // holds the agent in QA until someone fixes it
  manual?: AgentStatus | null
  liveDate?: ISODate | null // set when someone marks it live by hand
  linear?: string
  category?: Category // the work it takes over; prices its hours at the rate of the people who did it
}

export type Pause = { start: ISODate; days: number; reason: string }

export type LogEntry = { date: ISODate; text: string }

// ── delivery work (what we find, write and hand over) ───────────────────────

export type Tool = "ga" | "gads" | "hubspot" | "sheets" | "slides" | "docs" | "slack" | "gmail" | "asana"
export type Tier = "H" | "M" | "L"
export type Category = "Reporting" | "Paid media" | "Ops and admin" | "Client delivery" | "Creative" | "Sales"

export type Workflow = {
  id: string
  name: string // what the client sees
  rawName: string // what Shadow named it
  category: Category
  tier: Tier
  people: number
  runs: number // per 2 weeks
  avgMin: number
  minMin: number
  maxMin: number
  ways: number
  hoursWk: number // hours a week we can take back
  tools: Tool[]
  discoveredDay: number // day N it shows up in the review queue
  review: "new" | "published" | "hidden"
  mergedInto?: string | null
  clients?: string[] // client tags from Slack channels and the CRM
  verifiedBy?: string[] // people who confirmed it in their interview
  handoffBy?: string[] // people who named it as work to hand to an agent
  neverAutomate?: { by: string; note: string } | null // kept out of opportunities and the playbook
}

export type SopStep = { id: string; tool: Tool; before: string; label: string; after: string; mins: number; auto: boolean; tip?: string }
export type SopSection = { id: string; name: string; role: string; steps: SopStep[] }
export type Sop = {
  id: string
  workflowId: string
  title: string
  owner: string // on the client's team
  version: number
  checked: ISODate | null
  status: "draft" | "published"
  sections: SopSection[]
  history?: { v: number; at: ISODate; by: string; note: string }[] // client edits, newest first
}

export type GoalPriority = "High" | "Medium" | "Low"
export type Goal = { id: string; title: string; metric: string; target: number; categories: Category[]; status: "draft" | "published"; priority?: GoalPriority; team?: string | null /* a pod or function team; null = whole agency */; source?: string /* "From <name>'s interview" */
  level?: "company" | "team" | "personal" // company by default; team and personal goals point to a parent
  parent?: string | null // id of the goal it serves
  ownerId?: string | null // personal goals: the person who owns it
  wellbeing?: boolean // personal wellbeing goals stay private unless the person shares them
  shared?: boolean
  onTrack?: boolean }

/** The client locks its goals; after that only an approved change request (from Aalpha, in Studio) unlocks them. */
export type GoalLock = { locked: boolean; by: string | null; at: ISODate | null; pending: string | null }

export type FitPerson = {
  seatId: string
  team: string
  profile: "Driver" | "Connector" | "Analyst" | "Specialist" | null // from the Culture Intelligence survey
  fit: number | null // 0-100 fit to the role
  loadHrs: number // hours a week observed
  keyPerson: boolean
  reportsTo: string | null
  note?: { text: string; by: string } | null // role note from the person's interview
}

export type Report = {
  id: string
  kind: "wpu" | "scorecard" | "ceo" | "day90" | "custom"
  title: string
  period: string
  status: "draft" | "approved" | "sent"
  created: ISODate
  sent?: ISODate | null
  summary: string
  request?: string
}

/** What we ask the owner at kickoff so the numbers match how the business makes money. */
export type BusinessProfile = {
  offer: string
  pricing: string
  pods: { name: string; people: number; clients: number; revenueMo: number }[]
  execRate: number // loaded $ an hour for the owner, from payroll
  ownerValue: number // what the owner says an hour of their time is worth
  targetMargin: number // percent
  otherCompanies: { name: string; sources: string[] }[] // so leadership time splits by company
}

/** Feedback on one agent, from the client app, Slack or our own checks. */
export type AgentFeedback = { id: string; agentId: string; at: ISODate; who: string; source: "Client app" | "Slack" | "Studio"; text: string; status: "Open" | "Sent to Linear" | "Resolved" }

export type ChurnReason = "Didn't see enough value" | "Price" | "Budget cut" | "Doing it in-house" | "Champion left" | "Went with someone else" | "Other"
/** The renewal at day 90. Open from day 75, a proposal goes out, then an outcome: renewed at a
 *  price from a start date, or lost with a reason. Until it is decided, billing stops at day 90. */
export type Renewal = {
  stage: "Open" | "Proposal sent" | "Renewed" | "Lost"
  openedAt: ISODate
  proposedAt?: ISODate | null
  proposedPrice?: number | null
  decidedAt?: ISODate | null
  decidedBy?: string | null
  price?: number | null // agreed monthly price when renewed
  startsOn?: ISODate | null // first day of the monthly plan
  reason?: ChurnReason | null // why it was lost
  note?: string | null
}
export type Access = "Admin" | "Specialist" | "Viewer"
export type Member = { id: string; name: string; role: string; email: string; access?: Access }
/** One change in Studio: who made it, with which access, when, and to what. */
export type AuditEntry = { id: string; at: ISODate; time: string; by: string; access: Access; clientId: string | null; area: string; text: string; via?: string | null } // via: "client preview as Owner" when made inside the client app preview

export type ViewLog = { at: ISODate; who: string; clientId: string; role: string }

export type Settings = {
  seatFloor: number
  silentHours: number
  uploadDropPct: number
  failurePct: number
  queueHours: number
  costSpikeX: number
  costTargetMax: number
}

export type Role = "Owner" | "Manager" | "Member"

export type Capture = {
  allowApps: string[]
  allowDomains: string[]
  blockApps: string[]
  blockDomains: string[]
  days: number[] // 1 Mon … 5 Fri
  start: string // "08:00"
  end: string
  mode: "continuous" | "windows" // windows = two weeks a month after month 1
  membersCanPause: boolean
  membersCanBlock: boolean
  preset?: "work" | "247" | "custom" // 24/7 can only be set by an owner
}

export type Connections = {
  slackChannels: { name: string; on: boolean; private?: boolean; members?: number }[]
  autoNewChannels?: boolean
  slackDisclosure?: { by: string; at: ISODate } | null // the founder confirmed which channels Shadow reads
  channelExclude?: string[] // name patterns like client-* or random
  calendar: boolean
  hubspot: boolean
  callNotes: boolean
  payroll: "none" | "csv" | "api"
}

export type SeatPrefs = { pausedUntil: string | null; start: string | null; end: string | null; block: string[]; allow: string[]; checklist?: string[] }

/** Schedule an owner or manager sets for one person. Members can narrow it, never widen it. */
export type SeatSchedule = { days: number[]; start: string; end: string; preset?: "work" | "247" | "custom" }

/** Anything coming in: client asks, help requests, deletion requests, alerts, team notes. */
export type BugArea = "Capture" | "Pipeline" | "Slack" | "Connectors" | "Client app" | "Studio" | "Demo"
export type BugStatus = "Triage" | "Todo" | "In progress" | "In review" | "Done" | "Canceled"
/** A bug tracked in Studio and mirrored with a Linear issue. Linear owns the status; Studio shows it. */
export type Bug = {
  id: string
  linearId: string
  title: string
  detail: string
  clientId: string | null
  area: BugArea
  severity: "P0" | "P1" | "P2" | "P3"
  status: BugStatus
  assignee: string
  source: "Help chat" | "Slack" | "QA" | "Alert" | "Studio"
  reported: ISODate
  closed: ISODate | null
  release: string | null // the release it shipped in
  testAdded: boolean // a regression test now covers it
  requestId: string | null
  clientRaised: boolean // a client reported it, so the fix is answered in their Slack thread
  reply: string | null // what was sent back to them
  history: { at: ISODate; text: string }[]
}

export type Request = {
  id: string
  clientId: string | null
  from: string // who raised it
  source: "Client app" | "Member" | "Alert" | "Team" | "Report request" | "Slack"
  kind: "Question" | "Bug" | "Change" | "Data deletion" | "Report"
  title: string
  detail: string
  created: ISODate
  status: "New" | "In progress" | "Waiting on approval" | "Sent to Linear" | "Done" | "Declined"
  priority: "Urgent" | "High" | "Normal"
  assignee: string
  linear?: { id: string; state: "Todo" | "In progress" | "Done" } | null
  action?: "unlock-goals" // approving it unlocks the client's goals
  thread: { at: ISODate; who: string; text: string }[]
}

/** Real numbers from the Trivium pilot (Mina's CEO report and command-view spec, Oct 2026). */
export type Pilot = {
  label: string
  sales: { leads: number; within5m: number; medianReplyH: number; replied: number; booked: number; untouched: number; untouchedBig: number }
  redZone: { deals: number; withNext: number; closedLater: number; open: number; over14d: number }
  signed: { quotes: number; value: number; avg: number; loggedWrong: number; loggedWrongValue: number; ceoTagged: number }
  customers: { channels: number; quiet30: number; down30: number; up: number }
  clientResults: { last4: number; prior4: number; auditPausedSince: string }
  team: { posted: number; topShare: number; tasks: number; tasksFinished: number }
  ceo: { hoursObserved: number; messagesPct: number; meetingsPct: number; longestFocusMin: number; medianStretchSec: number; afterHoursPct: number; botMentionsPct: number; valuePerHour: number; asks6mo: number; asksToViktor: number; asksToCoo: number }
  collected: { uploads: number; events: number; slackMessages: number; channels: number }
}

export type Client = {
  id: string
  access: Record<string, Role> // seat id -> role in the client app
  capture: Capture
  connections: Connections
  pay: Record<string, number> // seat id -> loaded $ an hour (from payroll)
  paySrc?: Record<string, "Payroll" | "Pay stub" | "Estimate">
  prefs: Record<string, SeatPrefs>
  schedules: Record<string, SeatSchedule> // per-person schedules set by owner or manager
  ci: { connected: boolean; lastSync: ISODate | null; invitesSent: ISODate | null; surveyLink?: string; postedTo?: string | null }
  pilot?: Pilot
  workflows: Workflow[]
  sops: Sop[]
  goals: Goal[]
  goalLock?: GoalLock
  business?: BusinessProfile
  connectors?: Connector[]
  price?: number | null // recurring $ a month this client pays; kept when the list price changes
  sub?: SubSettings // admin changes to the subscription (sent to Stripe in the real build)
  contract?: { version: string; signed: ISODate; signer: string; term: string; url: string } | null // signed copy lives in the e-signature tool
  consentVersion?: string
  engagement?: { reportOpens30: number; reviewsMissed: number; ownerLeft?: boolean } // from report opens and calendar
  deliveryLate?: string[] // recurring deliverables delivered late or missed (sample)
  reportDelivery?: { cadence: "daily" | "weekly" | "realtime"; time: string }
  org?: "function" | "pod" | "hybrid" // how the agency is organized; function by default
  pods?: { name: string; lead: string; clients: string[] }[] // lead = seat id
  funcHeads?: Record<string, string> // function team -> seat id of its head
  viewTeams?: Record<string, string[]> // extra teams a manager may view without being in them
  teamsConfirmed?: ISODate | null // owner confirmed the suggested teams at kickoff
  agentFeedback?: AgentFeedback[]
  demo?: boolean // sample agency for sales demos; labelled as sample everywhere
  fit: FitPerson[]
  fitPublished: boolean
  fitImported: ISODate | null
  reports: Report[]
  name: string
  owner: string
  staff?: string[] // other Aalpha people assigned to this client; with the owner, the only non-Admins who see it
  plan: "upfront" | "monthly"
  signedDate: ISODate
  kickoffBooked: ISODate | null
  kickoffDate: ISODate | null
  agreementSigned: boolean
  paymentIn: boolean
  baselineSigned: ISODate | null
  goalsCaptured: boolean
  slackConnected: boolean
  viktorAccess: ISODate | null
  readoutDay: number // day N the readout is planned
  readoutAttended: boolean
  day90Attended: boolean
  usagePct: number | null // share of the team using agents (from Viktor usage)
  foundTarget: number // hours a week the audit ends up finding
  costPerSeatDay: number // AI cost per active computer per day, USD
  seats: Seat[]
  agents: Agent[]
  pauses: Pause[]
  updatesSent: ISODate[] // Fridays a Weekly Progress Update went out
  workflowsPublished: boolean
  renewalOpened: boolean
  offboardedAt?: ISODate | null // Shadow removed and data deletion scheduled after the client left
  renewal?: Renewal | null // the move from the 90 days to the monthly plan; nothing bills after day 90 without it
  linearKey: string
  slackSlug: string
  log: LogEntry[]
}

export type Sim = {
  pipelineFailing: boolean // vision errors across all clients
}

export type State = {
  version: number
  today: ISODate
  me: string // signed-in Aalpha user (Sign in with Slack later)
  team: Member[]
  clients: Client[]
  sim: Sim
  settings: Settings
  acks: Record<string, ISODate> // alert key -> snoozed until (exclusive)
  done: Record<string, ISODate> // action key -> day it was done (for the weekly scoreboard)
  assign: Record<string, string> // action key -> member name, when someone reassigns it
  viewLog: ViewLog[]
  requests: Request[]
  linearSeq: number
  sequence: SeqStep[] // onboarding autopilot message ladder, shared by every client
  autopilot: Record<string, boolean> // client id -> autopilot on
  sends: Send[]
  slack: Record<string, SlackHandled> // message id -> what we did with it
  sender: "Subhan" | "Assigned specialist" // who automated onboarding messages come from
  interviewSets?: Record<string, string[]> // role -> questions, editable in Studio
  pricing?: { recurring: { from: ISODate; monthly: number }[]; upfront: number; monthly: number } // list prices over time
  stripe?: { via: "key" | "composio"; at: ISODate } | null // how Stripe is connected (read-only)
  audit?: AuditEntry[] // every change, newest first
  bugs?: Bug[] // tracked bugs, mirrored with Linear
  feedback?: InsightFeedback[] // Useful / Not right / Already handled / Act on it, per insight card
}

export type FeedbackAction = "Useful" | "Not right" | "Already handled" | "Act on it"
export type InsightFeedback = { id: string; clientId: string; insightId: string; action: FeedbackAction; by: string; role: string; at: ISODate; version: string }

/** Where a person is in onboarding: the next thing they need to do. */
export type JourneyStage = "invite" | "install" | "permissions" | "extension" | "interview" | "recording" | "live" | "concern"
export type SeqStep = {
  id: string
  stage: JourneyStage
  after: number // hours stuck in the stage before it fires
  name: string
  channel: "Email" | "Slack DM" | "Slack thread" | "Owner DM" | "Call"
  from: "Sender" | "Client owner" // Sender = Subhan today; the client's assigned specialist later
  mode: "Auto" | "Approve" | "Manual"
  body: string
  howTo?: string[]
  on: boolean
}
export type Send = { id: string; clientId: string; seatIds: string[]; stepId: string; at: ISODate; status: "Sent" | "Skipped" | "Done"; by: string; body: string }
export type SlackHandled = { status: "Replied" | "Done" | "Request"; by: string; at: ISODate; reply?: string }

export type Severity = "Critical" | "High" | "Medium" | "Low"

export type Req = {
  n: number
  name: string
  status: "met" | "due" | "pending" | "missed" | "at_risk" | "late"
  detail: string
  source: string
}

export type Action = {
  key: string
  clientId: string
  clientName: string
  owner: string
  severity: Severity
  title: string
  why: string
  due: ISODate
  cta: string
  linear?: string
  tab?: string // opens this tab in the client cockpit instead of running
  run?: (c: Client, today: ISODate) => Client
}

export type Alert = {
  key: string
  clientId: string | null
  clientName: string
  severity: "Critical" | "Warning"
  title: string
  detail: string
  cta: string
  run?: (c: Client, today: ISODate) => Client
}

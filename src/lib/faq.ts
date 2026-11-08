// The questions people ask before they install, from the first beta teams (Trivium, Oct 2026),
// with the answers Subhan approved. Short on purpose: each one fits in a Slack reply.
// Only state what Shadow does today; scheduled pause and Chrome profiles are not built yet.

export type Faq = { id: string; q: string; a: string; asked: number }

export const FAQ: Faq[] = [
  { id: "own-laptop", asked: 5, q: "This is my own laptop. Will it only track work?",
    a: "Yes, that's the point. You choose the work apps and sites on an allowlist, and anything outside it isn't captured." },
  { id: "captures", asked: 4, q: "What does it capture? Is it recording my screen?",
    a: "Screenshots every so often, which app and site you're in, and clicks. No video, no microphone, no camera." },
  { id: "private", asked: 4, q: "What about personal stuff that ends up on screen?",
    a: "Private info is encrypted and redacted on your laptop before anything is sent, so we never see it." },
  { id: "pause", asked: 3, q: "Can I pause it outside work hours?",
    a: "Yes. Set your own hours and it switches off on its own outside them, and you can pause any time from the menu bar." },
  { id: "chrome", asked: 2, q: "Can I keep my personal Chrome profile out?",
    a: "Yes. The Shadow extension goes on your work profile, so we know which profile to focus on for your work and avoid looking at any other profiles." },
  { id: "slack", asked: 2, q: "Which Slack messages does Shadow read?",
    a: "Public channels, and the private channels your workspace admin is in. Never direct messages." },
  { id: "permissions", asked: 2, q: "What permissions does it need?",
    a: "Three Mac permissions: Screen Recording (screenshots), Accessibility (which app is active) and Input Monitoring (clicks)." },
  { id: "who-looks", asked: 2, q: "Is someone watching what I do?",
    a: "No. The analytics only look at high-level patterns: which tools, how long tasks take, where time goes." },
  { id: "security", asked: 1, q: "Is my data secure?",
    a: "It runs on SOC 2 and HIPAA compliant infrastructure, and we're working toward our own enterprise certification." },
  { id: "interview", asked: 1, q: "Who sees my interview answers?",
    a: "You approve the summary first. Then your manager sees it, and Subhan at Aalpha. The audio is deleted after processing." },
  { id: "manager", asked: 1, q: "What does my manager see?",
    a: "Your time by type of work and app as totals, and the workflows you repeat. Never your screenshots, window titles, blocked apps or your pay." },
  { id: "guide", asked: 1, q: "Is there a guide I can read?",
    a: "Yes, I'll send it over. Happy to do a 10-minute call and set it up with you too." },
]

export const faq = (id: string) => FAQ.find((f) => f.id === id)!

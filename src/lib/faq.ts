import { APP } from "@/lib/flags"
// The questions people ask before they install, from the first beta teams (Trivium, Oct 2026),
// with the answers Subhan approved. Short on purpose: each one fits in a Slack reply.
// Only state what Shadow does today; scheduled pause and Chrome profiles are not built yet.

export type Faq = { id: string; q: string; a: string; asked: number }

export const FAQ: Faq[] = [
  { id: "own-laptop", asked: 5, q: "This is my own laptop. Will it only track work?",
    a: "Yes. On your own laptop, pick work browser only: just the Chrome extension on your work profile, no app and no screenshots. Nothing outside that profile is seen." },
  { id: "against-me", asked: 5, q: "Can this be used against me?",
    a: "No. Your company agreed in writing that nothing here is used for reviews, pay, discipline or firing. Your manager sees team totals, never your own numbers." },
  { id: "captures", asked: 4, q: "What does it capture? Is it recording my screen?",
    a: "In work browser mode: the work sites you use and the steps you take in them, no screenshots. With the Mac app: screenshots at intervals, the app, site and clicks. Never what you type, and no video, microphone or camera." },
  { id: "private", asked: 4, q: "What about personal stuff that ends up on screen?",
    a: "Private info is redacted on your laptop before anything is sent, so we never see it. Screenshots are deleted after 7 days, and for your first 7 days nobody at your company sees anything from you, so you can delete anything first." },
  { id: "pause", asked: 3, q: "Can I pause it outside work hours?",
    a: "It only runs inside your work hours and stops when your screen locks. You can also pause any time from the menu bar." },
  { id: "chrome", asked: 2, q: "Can I keep my personal Chrome profile out?",
    a: `Yes. The ${APP} extension goes on your work profile, so we know which profile to focus on for your work and avoid looking at any other profiles.` },
  { id: "slack", asked: 2, q: `Which Slack messages does ${APP} read?`,
    a: "Public channels, and the private channels your workspace admin is in. Never direct messages." },
  { id: "permissions", asked: 2, q: "What permissions does it need?",
    a: "Work browser mode needs none. The Mac app asks for three: Screen Recording (screenshots), Accessibility (which app is active) and Input Monitoring. That last prompt mentions your keyboard; we use it for clicks only, never what you type." },
  { id: "who-looks", asked: 2, q: "Is someone watching what I do?",
    a: "No. Nobody watches a screen. It looks for repeat work across the team: which tools, how long tasks take, where time goes." },
  { id: "security", asked: 1, q: "Is my data secure?",
    a: "It runs on SOC 2 and HIPAA compliant infrastructure, and we're working toward our own enterprise certification." },
  { id: "interview", asked: 1, q: "Who sees my interview answers?",
    a: "You approve the summary first. Then your manager sees it, and Subhan at Aalpha. The audio is deleted after processing." },
  { id: "manager", asked: 1, q: "What does my manager see?",
    a: "Team totals, the workflows the team repeats, and the interview summary you approve. Never your own hours, screenshots, window titles, blocked apps or pay." },
  { id: "guide", asked: 1, q: "Is there a guide I can read?",
    a: "Yes, I'll send it over. Happy to do a 10-minute call and set it up with you too." },
]

export const faq = (id: string) => FAQ.find((f) => f.id === id)!

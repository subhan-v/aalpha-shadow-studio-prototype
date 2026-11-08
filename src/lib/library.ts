// Delivery library: the internal SOPs the team runs for every client, so nobody has to
// leave the Studio to find out how something is done. Ask Studio answers from these too.

export type LibStep = { text: string; tip?: string }
export type LibDoc = { id: string; title: string; when: string; owner: string; mins: number; tags: string[]; steps: LibStep[] }

export const LIBRARY: LibDoc[] = [
  {
    id: "onboard", title: "Onboard a new client", when: "Day 0, once the deal is won in the CRM", owner: "Account lead", mins: 90, tags: ["onboarding", "kickoff", "setup", "new client"],
    steps: [
      { text: "Check the client arrived from the CRM with the signed agreement and first payment." },
      { text: "Assign an account lead and a builder in the cockpit." },
      { text: "Create the client's Slack channel and invite the owner." },
      { text: "Book the kickoff call and send the Requirements for Success." },
      { text: "Collect the team list: name, job, manager, email." },
      { text: "Agree the recording schedule and team block list with the owner." },
      { text: "Lock the baseline the day the first computers record." },
    ],
  },
  {
    id: "team", title: "Set up a client's team in Shadow", when: "Kickoff week", owner: "Account lead", mins: 45, tags: ["seats", "install", "team", "invite", "schedule", "access"],
    steps: [
      { text: "Add every seat in Members and seats, with owner, manager and member access." },
      { text: "Set each person's recording hours if they differ from the team default." },
      { text: "Send install invites. Chase anyone not recording after 48 hours." },
      { text: "Connect Slack channels, calendar and call notes in Client settings." },
      { text: "Connect payroll, or upload one pay stub per person for hourly cost." },
      { text: "Send the Culture Intelligence survey invites from the Fit Map tab." },
      { text: "Confirm on the Activity page that every computer is sending data." },
    ],
  },
  {
    id: "viktor", title: "Install Viktor for a client", when: "Before the first agent goes live", owner: "Builder", mins: 60, tags: ["viktor", "install", "agent", "credits", "access"],
    steps: [
      { text: "Send the client our Viktor referral link, or get admin access to their workspace.", tip: "Referral link gives them $200 in starter credits." },
      { text: "Mark Viktor access in Setup the day it lands. Agents can't go live without it." },
      { text: "Connect the tools the first agent needs: Slack, Google, the CRM." },
      { text: "Run a 20-minute training with the people who will use the agent." },
      { text: "Turn on usage reporting so adoption shows in the cockpit." },
    ],
  },
  {
    id: "build", title: "Build an agent", when: "After the owner approves it", owner: "Builder", mins: 240, tags: ["build", "agent", "automation", "linear"],
    steps: [
      { text: "Open the workflow in Evidence and read three real runs end to end." },
      { text: "Write the SOP first. The agent follows the SOP, not the other way round." },
      { text: "Create the Linear issue from the Build plan, linked to the client." },
      { text: "Build in Viktor against a copy of the client's data." },
      { text: "Run the Agent QA checklist before anyone sees it." },
      { text: "Go live with one person for a week, then the whole team." },
    ],
  },
  {
    id: "qa", title: "Agent QA checklist", when: "Before every agent goes live, and after any change", owner: "Builder", mins: 30, tags: ["qa", "quality", "test", "agent", "check"],
    steps: [
      { text: "Ten real inputs from the last two weeks run without a person stepping in." },
      { text: "Output matches what the person would have done, checked by that person." },
      { text: "Nothing goes to a client without a human approving it for the first week." },
      { text: "Failures alert the client's Slack channel, not a dead inbox." },
      { text: "Minutes per run measured against the baseline and logged in Results." },
      { text: "Success under 90% for a week sends it back to building." },
    ],
  },
  {
    id: "wpu", title: "Weekly Progress Update", when: "Every Friday", owner: "Account lead", mins: 20, tags: ["weekly", "update", "friday", "report"],
    steps: [
      { text: "Open the client's Reports tab and generate the week's update." },
      { text: "Check hours found and hours back against the day-30 and day-90 targets." },
      { text: "Name one win, one risk and what happens next week." },
      { text: "Post in the client's Slack channel and mark it sent." },
    ],
  },
  {
    id: "readout", title: "Day-30 readout", when: "Day 28 to 32", owner: "Account lead", mins: 60, tags: ["day 30", "readout", "guarantee", "findings"],
    steps: [
      { text: "Confirm hours found are at or above 40 a week." },
      { text: "Pull the top workflows by value and the Fit Map." },
      { text: "Agree the next three agents with the owner." },
      { text: "Publish the Goals and the Playbook to the client app." },
      { text: "Log attendance. A missed readout pauses the guarantee clock." },
    ],
  },
  {
    id: "privacy", title: "Handle a data deletion request", when: "Whenever one arrives in Requests", owner: "Account lead", mins: 10, tags: ["delete", "deletion", "privacy", "data", "request"],
    steps: [
      { text: "Check the request came from the person whose data it is." },
      { text: "Check it doesn't fall inside the baseline week. If it does, talk to the owner first." },
      { text: "Approve or decline in Requests. The person sees the answer in their Settings." },
    ],
  },
]

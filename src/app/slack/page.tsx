"use client"

import { PageHeader } from "@/components/bits"
import { SlackQueue } from "@/components/slack-queue"

export default function Slack() {
  return (
    <>
      <PageHeader title="Slack" sub="Every message in every client channel, with how each channel feels this week. Reply, close, or turn it into a request." />
      <SlackQueue />
    </>
  )
}

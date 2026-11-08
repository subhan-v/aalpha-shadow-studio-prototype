"use client"

import { Download, FileJson, Printer } from "lucide-react"
import { Kpi, Section } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import type { Client } from "@/lib/types"
import { download, workbookJson, workbookMarkdown, WORKBOOK_SCHEMA } from "@/lib/workbook"

export function ExportTab({ c }: { c: Client }) {
  const { s } = useStore()
  const j = workbookJson(c, s.today)
  const md = workbookMarkdown(c, s.today)
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Kpi label="Goals" value={j.goals.length} />
        <Kpi label="SOPs" value={j.playbook.length} note="Published only" />
        <Kpi label="Fit Map people" value={j.fitMap.length} />
        <Kpi label="Automations live" value={j.automations.length} />
        <Kpi label="Workflows" value={j.workflows.length} />
      </div>
      <Section title="Workbook export" sub={`One file with everything the client owns. Schema ${WORKBOOK_SCHEMA}, stable IDs, imports cleanly into Notion or Google Docs.`}
        right={
          <div className="flex flex-wrap gap-2" data-print-hide>
            <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => download(`${slug}-workbook.md`, md, "text/markdown")}><Download />Markdown</Button>
            <Button size="sm" variant="outline" className="rounded-[10px]" onClick={() => download(`${slug}-workbook.json`, JSON.stringify(j, null, 2), "application/json")}><FileJson />JSON</Button>
            <Button size="sm" className="rounded-[10px]" onClick={() => window.print()}><Printer />Print or save as PDF</Button>
          </div>
        }>
        <pre data-print-area className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-2xl border bg-[var(--surface-2)] p-5 font-mono text-xs leading-relaxed">{md}</pre>
      </Section>
    </div>
  )
}

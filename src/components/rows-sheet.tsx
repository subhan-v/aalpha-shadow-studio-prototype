"use client"

// "Every number opens its rows" (audit 3.3): wrap a headline number so a click
// shows the table behind it.

import { ChevronRight } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type Col = { key: string; label: string; right?: boolean }

export function RowsSheet({ title, description, columns, rows, children, className }: { title: string; description?: string; columns: Col[]; rows: Record<string, React.ReactNode>[]; children: React.ReactNode; className?: string }) {
  return (
    <Sheet>
      <SheetTrigger render={<button className={cn("group relative block w-full text-left", className)} aria-label={`${title}: show the rows behind this number`} />}>
        {children}
        <ChevronRight aria-hidden className="absolute top-5 right-4 size-4 text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100" />
      </SheetTrigger>
      <SheetContent side="right" className="gap-0 bg-[var(--page)] data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b bg-card">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          {description && <SheetDescription className="text-xs">{description}</SheetDescription>}
        </SheetHeader>
        <div className="overflow-auto p-4">
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <Table>
              <TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key} className={c.right ? "text-right" : ""}>{c.label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell key={c.key} className={cn(c.right && "text-right tabular-nums")}>{r[c.key]}</TableCell>)}</TableRow>)}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">{rows.length} rows</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

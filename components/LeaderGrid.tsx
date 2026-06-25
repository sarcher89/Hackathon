'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markEntriesExported } from '@/app/actions/leader'
import { formatDayHeader, formatWeekRange, offsetWeek, toISODate } from '@/lib/dates'

export interface ExportEntry {
  id: string
  userName: string
  userEmail: string
  date: string
  clientName: string
  projectName: string | null
  taskName: string
  taskCategory: string
  hours: number
  notes: string | null
  exported: boolean
}

interface Props {
  weekStart: string
  dates: string[]
  entries: ExportEntry[]
}

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function generateCSV(entries: ExportEntry[]): string {
  const headers = ['Employee', 'Email', 'Date', 'Client', 'Project', 'Task', 'Category', 'Hours', 'Notes']
  const rows = entries.map(e => [
    e.userName,
    e.userEmail,
    e.date,
    e.clientName,
    e.projectName ?? '',
    e.taskName,
    e.taskCategory,
    String(e.hours),
    e.notes ?? '',
  ])
  return [headers, ...rows]
    .map(row => row.map(escapeCell).join(','))
    .join('\n')
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatHours(n: number): string {
  if (n === 0) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

export default function LeaderGrid({ weekStart, dates, entries }: Props) {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [exportedIds, setExportedIds] = useState<Set<string>>(
    new Set(entries.filter(e => e.exported).map(e => e.id))
  )

  const monday = new Date(weekStart + 'T00:00:00')
  const dayHeaders = dates.map(d => ({
    isoDate: d,
    ...formatDayHeader(new Date(d + 'T00:00:00')),
  }))

  // Group entries by user
  const userMap = new Map<string, { name: string; email: string; hours: Record<string, number> }>()
  for (const e of entries) {
    if (!userMap.has(e.userEmail)) {
      userMap.set(e.userEmail, { name: e.userName, email: e.userEmail, hours: {} })
    }
    const u = userMap.get(e.userEmail)!
    u.hours[e.date] = (u.hours[e.date] ?? 0) + e.hours
  }
  const users = Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Day totals across all users
  const dayTotals = dates.map(d =>
    entries.reduce((sum, e) => (e.date === d ? sum + e.hours : sum), 0)
  )
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0)

  const newEntries = entries.filter(e => !exportedIds.has(e.id))
  const hasNew = newEntries.length > 0

  function navigateWeek(offset: number) {
    const next = toISODate(offsetWeek(monday, offset))
    router.push(`/leader?week=${next}`)
  }

  async function handleExport(entriesToExport: ExportEntry[]) {
    if (entriesToExport.length === 0) return
    setExporting(true)

    const csv = generateCSV(entriesToExport)
    const filename = `payroll-${weekStart}.csv`
    downloadCSV(csv, filename)

    const ids = entriesToExport.map(e => e.id)
    await markEntriesExported(ids)
    setExportedIds(prev => new Set(Array.from(prev).concat(ids)))

    setExporting(false)
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigateWeek(-1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ← Prev
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {formatWeekRange(monday)}
        </span>
        <button
          onClick={() => navigateWeek(1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Export buttons */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => handleExport(entries)}
          disabled={exporting || entries.length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exporting…' : 'Export all as CSV'}
        </button>
        {hasNew && (
          <button
            onClick={() => handleExport(newEntries)}
            disabled={exporting}
            className="rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            Export new only ({newEntries.length} entries)
          </button>
        )}
        {entries.length === 0 && (
          <p className="text-sm text-slate-400">No entries logged this week.</p>
        )}
      </div>

      {/* Summary table */}
      {users.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[180px]">
                  Employee
                </th>
                {dayHeaders.map(h => (
                  <th
                    key={h.isoDate}
                    className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-16"
                  >
                    <div>{h.day}</div>
                    <div className="text-slate-400 normal-case font-normal">{h.shortDate}</div>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const rowTotal = dates.reduce((sum, d) => sum + (u.hours[d] ?? 0), 0)
                return (
                  <tr key={u.email} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <div className="text-xs font-medium text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    {dates.map(d => (
                      <td key={d} className="px-2 py-2 text-center text-xs text-slate-600">
                        {formatHours(u.hours[d] ?? 0)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center text-xs font-bold text-slate-800">
                      {formatHours(rowTotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Team Total
                </td>
                {dayTotals.map((total, i) => (
                  <td key={dates[i]} className="px-2 py-2 text-center text-xs font-bold text-slate-700">
                    {formatHours(total)}
                  </td>
                ))}
                <td className="px-2 py-2 text-center text-xs font-bold text-slate-900">
                  {formatHours(weekTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Export legend */}
      {entries.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {exportedIds.size} of {entries.length} entries already exported this week.
        </p>
      )}
    </div>
  )
}

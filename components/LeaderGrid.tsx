'use client'

import { Fragment, useState } from 'react'
import {
  markEntriesExported,
  getEmployeePayPeriods,
  getPayPeriodEntries,
  getPayPeriodClockSessions,
  type PayPeriodSummary,
} from '@/app/actions/leader'
import { generatePayrollWorkbook } from '@/app/actions/export'
import { formatDayHeader, formatPeriodRange } from '@/lib/dates'

export interface ExportEntry {
  id: string
  userId: string
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

export interface ExportClockSession {
  id: string
  userId: string
  userEmail: string
  date: string
  clockedInAt: string
  clockedOutAt: string | null
  hours: number | null
}

interface Props {
  weekStart: string
  periodDates: string[]
  entries: ExportEntry[]
  clockSessions: ExportClockSession[]
}

function downloadWorkbook(base64: string, filename: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
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

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'employee'
}

export default function LeaderGrid({ weekStart, periodDates, entries, clockSessions }: Props) {
  const [exporting, setExporting] = useState(false)
  const [exportedIds, setExportedIds] = useState<Set<string>>(
    new Set(entries.filter(e => e.exported).map(e => e.id))
  )

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [periods, setPeriods] = useState<PayPeriodSummary[]>([])
  const [loadingPeriods, setLoadingPeriods] = useState(false)
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const periodStart = new Date(weekStart + 'T00:00:00')
  const dayHeaders = periodDates.map(d => ({
    isoDate: d,
    ...formatDayHeader(new Date(d + 'T00:00:00')),
  }))

  // Group entries by user
  const userMap = new Map<string, { id: string; name: string; email: string; hours: Record<string, number> }>()
  for (const e of entries) {
    if (!userMap.has(e.userEmail)) {
      userMap.set(e.userEmail, { id: e.userId, name: e.userName, email: e.userEmail, hours: {} })
    }
    const u = userMap.get(e.userEmail)!
    u.hours[e.date] = (u.hours[e.date] ?? 0) + e.hours
  }
  const users = Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Day totals across all users
  const dayTotals = periodDates.map(d =>
    entries.reduce((sum, e) => (e.date === d ? sum + e.hours : sum), 0)
  )
  const periodTotal = dayTotals.reduce((a, b) => a + b, 0)

  const newEntries = entries.filter(e => !exportedIds.has(e.id))
  const hasNew = newEntries.length > 0

  async function handleExport(entriesToExport: ExportEntry[]) {
    if (entriesToExport.length === 0) return
    setExporting(true)

    const base64 = await generatePayrollWorkbook(
      entriesToExport,
      clockSessions,
      `Pay Period: ${formatPeriodRange(periodStart)}`
    )
    downloadWorkbook(base64, `payroll-${weekStart}.xlsx`)

    const ids = entriesToExport.map(e => e.id)
    await markEntriesExported(ids)
    setExportedIds(prev => new Set(Array.from(prev).concat(ids)))

    setExporting(false)
  }

  async function toggleEmployeeExpanded(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null)
      return
    }

    setExpandedUserId(userId)
    setPeriods([])
    setSelectedPeriods(new Set())
    setLoadingPeriods(true)
    const result = await getEmployeePayPeriods(userId)
    setPeriods(result)
    setLoadingPeriods(false)
  }

  function togglePeriod(periodStart: string) {
    setSelectedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(periodStart)) next.delete(periodStart)
      else next.add(periodStart)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedPeriods(prev =>
      prev.size === periods.length ? new Set() : new Set(periods.map(p => p.periodStart))
    )
  }

  async function handleDownloadSelected(employee: { id: string; name: string }) {
    if (selectedPeriods.size === 0) return
    setDownloading(true)

    const [selectedEntries, selectedSessions] = await Promise.all([
      getPayPeriodEntries(employee.id, Array.from(selectedPeriods)),
      getPayPeriodClockSessions(employee.id, Array.from(selectedPeriods)),
    ])
    const periodLabels = periods
      .filter(p => selectedPeriods.has(p.periodStart))
      .map(p => p.label)
      .join(', ')
    const base64 = await generatePayrollWorkbook(
      selectedEntries,
      selectedSessions,
      `${employee.name} — ${periodLabels}`
    )
    downloadWorkbook(base64, `payroll-${slugify(employee.name)}.xlsx`)

    const ids = selectedEntries.map(e => e.id)
    await markEntriesExported(ids)

    setDownloading(false)
  }

  const allPeriodsSelected = periods.length > 0 && selectedPeriods.size === periods.length
  const columnCount = periodDates.length + 2

  return (
    <div>
      {/* Current pay period */}
      <div className="mb-4 flex items-center justify-center">
        <span className="text-sm font-semibold text-slate-700">
          {formatPeriodRange(periodStart)}
        </span>
      </div>

      {/* Export buttons */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => handleExport(entries)}
          disabled={exporting || entries.length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exporting…' : 'Export all as Excel'}
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
          <p className="text-sm text-slate-400">No entries logged this pay period.</p>
        )}
      </div>

      <p className="mb-2 text-xs text-slate-400">Click an employee&rsquo;s name to export their past pay periods.</p>

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
                    className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-14"
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
                const rowTotal = periodDates.reduce((sum, d) => sum + (u.hours[d] ?? 0), 0)
                const isExpanded = expandedUserId === u.id
                return (
                  <Fragment key={u.id}>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleEmployeeExpanded(u.id)}
                          className="flex items-center gap-1.5 text-left"
                        >
                          <svg
                            className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                            viewBox="0 0 16 16" fill="none"
                          >
                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>
                            <div className="text-xs font-medium text-blue-700 hover:underline">{u.name}</div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </span>
                        </button>
                      </td>
                      {periodDates.map(d => (
                        <td key={d} className="px-2 py-2 text-center text-xs text-slate-600">
                          {formatHours(u.hours[d] ?? 0)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center text-xs font-bold text-slate-800">
                        {formatHours(rowTotal)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={columnCount} className="px-4 py-4">
                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <h4 className="mb-3 text-sm font-semibold text-slate-700">
                              Export pay periods for {u.name}
                            </h4>

                            {loadingPeriods ? (
                              <p className="text-sm text-slate-400">Loading pay periods…</p>
                            ) : periods.length === 0 ? (
                              <p className="text-sm text-slate-400">No pay periods found for this employee.</p>
                            ) : (
                              <>
                                <div className="mb-2 flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={allPeriodsSelected}
                                      onChange={toggleSelectAll}
                                      className="rounded border-slate-300"
                                    />
                                    Select all ({periods.length} pay periods)
                                  </label>
                                  <button
                                    onClick={() => handleDownloadSelected({ id: u.id, name: u.name })}
                                    disabled={downloading || selectedPeriods.size === 0}
                                    className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                  >
                                    {downloading ? 'Downloading…' : `Download selected (${selectedPeriods.size})`}
                                  </button>
                                </div>

                                <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
                                  <table className="min-w-full text-sm">
                                    <tbody className="divide-y divide-slate-100">
                                      {periods.map(p => (
                                        <tr key={p.periodStart} className="hover:bg-slate-50/50">
                                          <td className="px-3 py-2 w-8">
                                            <input
                                              type="checkbox"
                                              checked={selectedPeriods.has(p.periodStart)}
                                              onChange={() => togglePeriod(p.periodStart)}
                                              className="rounded border-slate-300"
                                            />
                                          </td>
                                          <td className="px-3 py-2 text-sm text-slate-700">{p.label}</td>
                                          <td className="px-3 py-2 text-right text-sm text-slate-500">
                                            {formatHours(p.hours)} hrs
                                          </td>
                                          <td className="px-3 py-2 text-right text-xs text-slate-400">
                                            {p.entryCount} {p.entryCount === 1 ? 'entry' : 'entries'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Team Total
                </td>
                {dayTotals.map((total, i) => (
                  <td key={periodDates[i]} className="px-2 py-2 text-center text-xs font-bold text-slate-700">
                    {formatHours(total)}
                  </td>
                ))}
                <td className="px-2 py-2 text-center text-xs font-bold text-slate-900">
                  {formatHours(periodTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Export legend */}
      {entries.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {exportedIds.size} of {entries.length} entries already exported this pay period.
        </p>
      )}
    </div>
  )
}

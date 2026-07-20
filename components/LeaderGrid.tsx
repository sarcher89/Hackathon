'use client'

import { Fragment, useEffect, useState } from 'react'
import {
  markEntriesExported,
  getEmployeePayPeriods,
  getPayPeriodEntries,
  getPayPeriodClockSessions,
  getAllPayPeriods,
  getPayPeriodEntriesAllUsers,
  getPayPeriodClockSessionsAllUsers,
  type PayPeriodSummary,
} from '@/app/actions/leader'
import { generatePayrollWorkbook } from '@/app/actions/export'
import { formatDayHeader, formatPeriodRange, getPeriodDates, toISODate } from '@/lib/dates'

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
  notes: string | null
}

interface Props {
  weekStart: string
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

function formatSessionTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

interface TaskLogDay {
  date: string
  day: string
  shortDate: string
  rows: ExportEntry[]
  hours: number
}

function buildTaskLogByDay(employeeEntries: ExportEntry[], periodDates: string[]): TaskLogDay[] {
  const byDate = new Map<string, ExportEntry[]>()
  for (const e of employeeEntries) {
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push(e)
  }
  return periodDates
    .filter(d => byDate.has(d))
    .map(date => {
      const rows = byDate.get(date)!
      return {
        date,
        ...formatDayHeader(new Date(date + 'T00:00:00')),
        rows,
        hours: rows.reduce((sum, r) => sum + r.hours, 0),
      }
    })
}

function ClockedTimeByDay({
  sessions,
  periodDates,
}: {
  sessions: ExportClockSession[]
  periodDates: string[]
}) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const byDate = new Map<string, ExportClockSession[]>()
  for (const s of sessions) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date)!.push(s)
  }

  const rows = periodDates.map(d => {
    const daySessions = byDate.get(d) ?? []
    return {
      date: d,
      ...formatDayHeader(new Date(d + 'T00:00:00')),
      sessions: daySessions,
      hours: daySessions.reduce((sum, s) => sum + (s.hours ?? 0), 0),
    }
  })

  return (
    <div className="overflow-hidden rounded border border-slate-200">
      {rows.map(row => {
        const isWeekend = new Date(row.date + 'T00:00:00').getDay() % 6 === 0
        const hasSessions = row.sessions.length > 0
        const isExpanded = expandedDates.has(row.date)
        return (
          <div key={row.date} className="border-t border-slate-200 first:border-t-0">
            <button
              onClick={() => hasSessions && toggleDate(row.date)}
              disabled={!hasSessions}
              className={[
                'flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors',
                isWeekend ? 'bg-slate-50/60' : 'bg-white',
                hasSessions ? 'hover:bg-slate-50' : 'cursor-default',
              ].join(' ')}
            >
              <span className="flex items-center gap-1.5">
                {hasSessions && (
                  <svg
                    className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                    viewBox="0 0 16 16" fill="none"
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className={`text-sm font-medium ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                  {row.day} {row.shortDate}
                </span>
              </span>
              <span className={`text-sm font-semibold ${row.hours > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                {formatHours(row.hours)}
              </span>
            </button>

            {isExpanded && hasSessions && (
              <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-2">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left font-semibold uppercase tracking-wide text-slate-400">
                      <th className="py-1 pr-3">Clock In</th>
                      <th className="py-1 pr-3">Clock Out</th>
                      <th className="py-1 pr-3 text-right">Hours</th>
                      <th className="py-1">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {row.sessions.map(s => (
                      <tr key={s.id}>
                        <td className="py-1.5 pr-3 text-slate-600">{formatSessionTime(s.clockedInAt)}</td>
                        <td className="py-1.5 pr-3 text-slate-600">
                          {s.clockedOutAt ? formatSessionTime(s.clockedOutAt) : (
                            <span className="font-medium text-green-600">Currently clocked in</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-semibold text-slate-700">
                          {s.hours !== null ? formatHours(s.hours) : '—'}
                        </td>
                        <td className="py-1.5 text-slate-500">{s.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center gap-1.5 text-left text-sm font-semibold text-slate-700"
      >
        <svg
          className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
          viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

export default function LeaderGrid({
  weekStart: initialWeekStart,
  entries: initialEntries,
  clockSessions: initialClockSessions,
}: Props) {
  // Period selection is local to this component — switching periods here
  // never touches the URL, so it can't leak into other tabs, and other
  // tabs' period changes can't leak in here either.
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [entries, setEntries] = useState<ExportEntry[]>(initialEntries)
  const [clockSessions, setClockSessions] = useState<ExportClockSession[]>(initialClockSessions)
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [exportedIds, setExportedIds] = useState<Set<string>>(
    new Set(initialEntries.filter(e => e.exported).map(e => e.id))
  )

  const [periodOptions, setPeriodOptions] = useState<PayPeriodSummary[]>([])
  useEffect(() => {
    getAllPayPeriods().then(setPeriodOptions)
  }, [])

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [periods, setPeriods] = useState<PayPeriodSummary[]>([])
  const [loadingPeriods, setLoadingPeriods] = useState(false)
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)

  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [teamPeriods, setTeamPeriods] = useState<PayPeriodSummary[]>([])
  const [loadingTeamPeriods, setLoadingTeamPeriods] = useState(false)
  const [selectedTeamPeriods, setSelectedTeamPeriods] = useState<Set<string>>(new Set())
  const [downloadingTeam, setDownloadingTeam] = useState(false)

  const periodStart = new Date(weekStart + 'T00:00:00')
  const periodDates = getPeriodDates(periodStart).map(toISODate)
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
    setShowPeriodPicker(false)
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

  const [exportingCurrentFor, setExportingCurrentFor] = useState<string | null>(null)

  async function handleExportCurrentPeriod(employee: { id: string; name: string }) {
    setExportingCurrentFor(employee.id)

    const [currentEntries, currentSessions] = await Promise.all([
      getPayPeriodEntries(employee.id, [weekStart]),
      getPayPeriodClockSessions(employee.id, [weekStart]),
    ])
    const base64 = await generatePayrollWorkbook(
      currentEntries,
      currentSessions,
      `${employee.name} — ${formatPeriodRange(periodStart)}`
    )
    downloadWorkbook(base64, `payroll-${slugify(employee.name)}.xlsx`)

    const ids = currentEntries.map(e => e.id)
    await markEntriesExported(ids)
    setExportedIds(prev => new Set(Array.from(prev).concat(ids)))

    setExportingCurrentFor(null)
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

  async function handlePeriodChange(next: string) {
    setLoadingPeriod(true)
    const [nextEntries, nextSessions] = await Promise.all([
      getPayPeriodEntriesAllUsers([next]),
      getPayPeriodClockSessionsAllUsers([next]),
    ])
    setWeekStart(next)
    setEntries(nextEntries)
    setClockSessions(nextSessions)
    setExportedIds(new Set(nextEntries.filter(e => e.exported).map(e => e.id)))
    setLoadingPeriod(false)
  }

  async function toggleTeamPicker() {
    if (showTeamPicker) {
      setShowTeamPicker(false)
      return
    }

    setShowTeamPicker(true)
    setTeamPeriods([])
    setSelectedTeamPeriods(new Set([weekStart]))
    setLoadingTeamPeriods(true)
    const result = await getAllPayPeriods()
    setTeamPeriods(result)
    setLoadingTeamPeriods(false)
  }

  function toggleTeamPeriod(periodStart: string) {
    setSelectedTeamPeriods(prev => {
      const next = new Set(prev)
      if (next.has(periodStart)) next.delete(periodStart)
      else next.add(periodStart)
      return next
    })
  }

  function toggleTeamSelectAll() {
    setSelectedTeamPeriods(prev =>
      prev.size === teamPeriods.length ? new Set() : new Set(teamPeriods.map(p => p.periodStart))
    )
  }

  async function handleDownloadTeamSelected() {
    if (selectedTeamPeriods.size === 0) return
    setDownloadingTeam(true)

    const periodStarts = Array.from(selectedTeamPeriods)
    const [selectedEntries, selectedSessions] = await Promise.all([
      getPayPeriodEntriesAllUsers(periodStarts),
      getPayPeriodClockSessionsAllUsers(periodStarts),
    ])
    const periodLabels = teamPeriods
      .filter(p => selectedTeamPeriods.has(p.periodStart))
      .map(p => p.label)
      .join(', ')
    const base64 = await generatePayrollWorkbook(
      selectedEntries,
      selectedSessions,
      `Pay Period(s): ${periodLabels}`
    )
    downloadWorkbook(base64, `payroll-team-${periodStarts[0]}.xlsx`)

    const ids = selectedEntries.map(e => e.id)
    await markEntriesExported(ids)
    setExportedIds(prev => new Set(Array.from(prev).concat(ids)))

    setDownloadingTeam(false)
  }

  const allTeamPeriodsSelected = teamPeriods.length > 0 && selectedTeamPeriods.size === teamPeriods.length

  return (
    <div>
      {/* Pay period selector */}
      <div className="mb-4 flex items-center justify-between">
        <select
          value={weekStart}
          onChange={e => handlePeriodChange(e.target.value)}
          disabled={loadingPeriod}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:opacity-50"
        >
          {!periodOptions.some(p => p.periodStart === weekStart) && (
            <option value={weekStart}>{formatPeriodRange(periodStart)}</option>
          )}
          {periodOptions.map(p => (
            <option key={p.periodStart} value={p.periodStart}>
              {p.label}
            </option>
          ))}
        </select>
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
          {exporting ? 'Exporting…' : 'Export Current Pay Period'}
        </button>
        <button
          onClick={toggleTeamPicker}
          className="rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          Export by Pay Period…
        </button>
        {entries.length === 0 && (
          <p className="text-sm text-slate-400">No entries logged this pay period.</p>
        )}
      </div>

      {showTeamPicker && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">
            Choose pay period(s) to export for all employees
          </h4>

          {loadingTeamPeriods ? (
            <p className="text-sm text-slate-400">Loading pay periods…</p>
          ) : teamPeriods.length === 0 ? (
            <p className="text-sm text-slate-400">No pay periods found.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={allTeamPeriodsSelected}
                    onChange={toggleTeamSelectAll}
                    className="rounded border-slate-300"
                  />
                  Select all ({teamPeriods.length} pay periods)
                </label>
                <button
                  onClick={handleDownloadTeamSelected}
                  disabled={downloadingTeam || selectedTeamPeriods.size === 0}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {downloadingTeam ? 'Downloading…' : `Download selected (${selectedTeamPeriods.size})`}
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {teamPeriods.map(p => (
                      <tr key={p.periodStart} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 w-8">
                          <input
                            type="checkbox"
                            checked={selectedTeamPeriods.has(p.periodStart)}
                            onChange={() => toggleTeamPeriod(p.periodStart)}
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
      )}

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
                        <td colSpan={columnCount} className="px-4 py-4 space-y-4">
                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleExportCurrentPeriod({ id: u.id, name: u.name })}
                                disabled={exportingCurrentFor === u.id}
                                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {exportingCurrentFor === u.id ? 'Exporting…' : 'Export Current Pay Period'}
                              </button>
                              <button
                                onClick={() => setShowPeriodPicker(prev => !prev)}
                                className="flex items-center gap-1.5 rounded border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                <svg
                                  className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${showPeriodPicker ? '' : '-rotate-90'}`}
                                  viewBox="0 0 16 16" fill="none"
                                >
                                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Export by Pay Period
                              </button>
                            </div>

                            {showPeriodPicker && (
                              <div className="mt-3">
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
                            )}
                          </div>

                          <CollapsibleSection title={`Time by Task — ${formatPeriodRange(periodStart)}`}>
                            {(() => {
                              const days = buildTaskLogByDay(entries.filter(e => e.userId === u.id), periodDates)
                              if (days.length === 0) {
                                return <p className="text-sm text-slate-400">No entries logged this pay period.</p>
                              }
                              return (
                                <div className="space-y-3">
                                  {days.map(day => (
                                    <div key={day.date} className="overflow-hidden rounded border border-slate-200">
                                      <div className="flex items-center justify-between bg-slate-100 px-3 py-2">
                                        <span className="text-sm font-semibold text-slate-700">
                                          {day.day} {day.shortDate}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-700">
                                          {formatHours(day.hours)}
                                        </span>
                                      </div>
                                      <table className="min-w-full text-sm">
                                        <thead>
                                          <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                              Client
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                              Project
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                              Task
                                            </th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                              Hours
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {day.rows.map(row => (
                                            <tr key={row.id} className="hover:bg-slate-50/50">
                                              <td className="px-3 py-2 text-sm text-slate-700">{row.clientName}</td>
                                              <td className="px-3 py-2 text-sm text-slate-500">{row.projectName ?? '—'}</td>
                                              <td className="px-3 py-2 text-sm text-slate-700">{row.taskName}</td>
                                              <td className="px-3 py-2 text-right text-sm font-semibold text-slate-700">
                                                {formatHours(row.hours)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              )
                            })()}
                          </CollapsibleSection>

                          <CollapsibleSection title={`Clocked Time — ${formatPeriodRange(periodStart)}`}>
                            <ClockedTimeByDay
                              sessions={clockSessions.filter(s => s.userId === u.id)}
                              periodDates={periodDates}
                            />
                          </CollapsibleSection>
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

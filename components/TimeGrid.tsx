'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Client, Project, Task } from '@/types/database'
import { saveTimeEntry, clearRowEntries, getMyProjectLogPeriods, type MyPeriodOption } from '@/app/actions/time-entries'
import { formatDayHeader, getPeriodStart, formatPeriodRange, toISODate, roundToQuarterHour } from '@/lib/dates'
import Combobox from '@/components/Combobox'
import { ClockSessionRow } from '@/components/TimeSheet'

interface GridRow {
  rowId: string
  clientId: string
  projectId: string | null
  taskId: string
  hours: Record<string, string>
  notes: Record<string, string>
}

interface TimeGridProps {
  weekStart: string
  periodDates: string[]
  clients: Client[]
  projectsByClient: Record<string, Project[]>
  tasks: Task[]
  initialRows: GridRow[]
  clockSessionRows?: ClockSessionRow[]
}

let rowSeq = 0
function nextRowId() {
  return `new-${++rowSeq}`
}

function emptyRow(): GridRow {
  return { rowId: nextRowId(), clientId: '', projectId: null, taskId: '', hours: {}, notes: {} }
}

function getTasksForClient(tasks: Task[], clients: Client[], clientId: string): Task[] {
  const client = clients.find(c => c.id === clientId)
  if (!client) return tasks
  return tasks.filter(t => {
    if (t.system === 'both') return true
    if (client.system === 'denticon') return t.system === 'denticon'
    if (client.system === 'cloud9') return t.system === 'cloud9'
    return true
  })
}


function formatHours(n: number): string {
  if (n === 0) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

export default function TimeGrid({
  weekStart,
  periodDates,
  clients,
  projectsByClient,
  tasks,
  initialRows,
  clockSessionRows,
}: TimeGridProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [rows, setRows] = useState<GridRow[]>(
    initialRows.length > 0 ? initialRows : [emptyRow()]
  )
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const [periodOptions, setPeriodOptions] = useState<MyPeriodOption[]>([])
  useEffect(() => {
    getMyProjectLogPeriods().then(setPeriodOptions)
  }, [])

  const periodStart = getPeriodStart(new Date(weekStart + 'T00:00:00'))
  const dayHeaders = periodDates.map(d => ({
    isoDate: d,
    ...formatDayHeader(new Date(d + 'T00:00:00')),
  }))

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(rowId: string) {
    const row = rows.find(r => r.rowId === rowId)
    setRows(prev => prev.filter(r => r.rowId !== rowId))

    if (row?.clientId && row.taskId) {
      clearRowEntries({
        clientId: row.clientId,
        projectId: row.projectId,
        taskId: row.taskId,
        dates: periodDates,
      }).catch(console.error)
    }
  }

  function updateSelector(
    rowId: string,
    field: 'clientId' | 'projectId' | 'taskId',
    value: string | null
  ) {
    setRows(prev =>
      prev.map(row => {
        if (row.rowId !== rowId) return row

        const hadData = row.clientId && row.taskId && Object.keys(row.hours).length > 0
        if (hadData) {
          clearRowEntries({
            clientId: row.clientId,
            projectId: row.projectId,
            taskId: row.taskId,
            dates: periodDates,
          }).catch(console.error)
        }

        if (field === 'clientId') {
          return { ...row, clientId: value ?? '', projectId: null, taskId: '', hours: {} }
        }
        if (field === 'projectId') {
          return { ...row, projectId: value || null, hours: {} }
        }
        return { ...row, taskId: value ?? '', hours: {} }
      })
    )
  }

  function updateHoursLocal(rowId: string, date: string, value: string) {
    setRows(prev =>
      prev.map(r =>
        r.rowId === rowId ? { ...r, hours: { ...r.hours, [date]: value } } : r
      )
    )
  }

  async function saveCell(rowId: string, date: string) {
    const row = rows.find(r => r.rowId === rowId)
    if (!row?.clientId || !row.taskId) return

    const raw = row.hours[date] ?? ''
    const hours = Math.max(0, Math.round((parseFloat(raw) || 0) * 4) / 4)
    const cellKey = `${rowId}|${date}`

    setSaving(prev => new Set(prev).add(cellKey))
    setErrors(prev => {
      const next = new Map(prev)
      next.delete(cellKey)
      return next
    })

    const result = await saveTimeEntry({
      clientId: row.clientId,
      projectId: row.projectId,
      taskId: row.taskId,
      date,
      hours,
    })

    setSaving(prev => {
      const next = new Set(prev)
      next.delete(cellKey)
      return next
    })

    if (!result.success) {
      setErrors(prev => new Map(prev).set(cellKey, result.error))
    }
  }

  const [noteRow, setNoteRow] = useState<{ rowId: string; date: string; locked: boolean } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  function eligibleNoteDates(row: GridRow): string[] {
    return periodDates.filter(d => (parseFloat(row.hours[d] ?? '') || 0) > 0)
  }

  // Opened from the per-cell icon — date is already known, no picker needed.
  function openNoteEditor(rowId: string, date: string) {
    const row = rows.find(r => r.rowId === rowId)
    setNoteDraft(row?.notes[date] ?? '')
    setNoteRow({ rowId, date, locked: true })
  }

  // Opened from the row-level "Notes" column — let the user pick which date.
  function openRowNotes(rowId: string) {
    const row = rows.find(r => r.rowId === rowId)
    if (!row) return
    const dates = eligibleNoteDates(row)
    const withExisting = dates.find(d => row.notes[d])
    const date = withExisting ?? dates[0] ?? ''
    setNoteDraft(date ? row.notes[date] ?? '' : '')
    setNoteRow({ rowId, date, locked: false })
  }

  function changeNoteDate(date: string) {
    if (!noteRow) return
    const row = rows.find(r => r.rowId === noteRow.rowId)
    setNoteDraft(row?.notes[date] ?? '')
    setNoteRow({ ...noteRow, date })
  }

  async function saveNote() {
    if (!noteRow) return
    const row = rows.find(r => r.rowId === noteRow.rowId)
    if (!row?.clientId || !row.taskId) return

    const hours = Math.max(0, Math.round((parseFloat(row.hours[noteRow.date] ?? '') || 0) * 4) / 4)
    setSavingNote(true)
    const result = await saveTimeEntry({
      clientId: row.clientId,
      projectId: row.projectId,
      taskId: row.taskId,
      date: noteRow.date,
      hours,
      notes: noteDraft,
    })
    setSavingNote(false)

    if (result.success) {
      setRows(prev =>
        prev.map(r =>
          r.rowId === noteRow.rowId
            ? { ...r, notes: { ...r.notes, [noteRow.date]: noteDraft } }
            : r
        )
      )
      setNoteRow(null)
    }
  }

  function handlePeriodChange(next: string) {
    router.push(`${pathname}?week=${next}`)
  }

  const dayTotals = periodDates.map(date =>
    rows.reduce((sum, r) => sum + (parseFloat(r.hours[date] ?? '') || 0), 0)
  )
  const periodTotal = dayTotals.reduce((a, b) => a + b, 0)

  const clockedByDate: Record<string, number> = {}
  for (const s of clockSessionRows ?? []) {
    if (s.hours === null) continue
    clockedByDate[s.date] = (clockedByDate[s.date] ?? 0) + roundToQuarterHour(s.hours)
  }

  return (
    <div>
      {/* Period selector */}
      <div className="mb-4 flex items-center justify-between">
        <select
          value={toISODate(periodStart)}
          onChange={e => handlePeriodChange(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {!periodOptions.some(p => p.periodStart === toISODate(periodStart)) && (
            <option value={toISODate(periodStart)}>{formatPeriodRange(periodStart)}</option>
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

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[144px]">
                Client
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[128px]">
                Project
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[160px]">
                Task
              </th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">
                Notes
              </th>
              {dayHeaders.map(h => (
                <th
                  key={h.isoDate}
                  className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-16"
                >
                  <div>{h.day}</div>
                  <div className="text-slate-400 normal-case font-normal">{h.shortDate}</div>
                  {clockedByDate[h.isoDate] > 0 && (
                    <div className="text-slate-400 normal-case font-normal" title="Hours clocked in/out that day">
                      Clocked {formatHours(clockedByDate[h.isoDate])}
                    </div>
                  )}
                </th>
              ))}
              <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">
                Total
              </th>
              <th className="w-8" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map(row => {
              const rowTotal = periodDates.reduce(
                (sum, d) => sum + (parseFloat(row.hours[d] ?? '') || 0),
                0
              )
              const clientTasks = getTasksForClient(tasks, clients, row.clientId)
              const projects = row.clientId ? (projectsByClient[row.clientId] ?? []) : []
              const isTimeOff = clients.find(c => c.id === row.clientId)?.name === 'Time Off'
              const rowHasEligibleDate = eligibleNoteDates(row).length > 0
              const rowHasNote = Object.values(row.notes).some(Boolean)

              return (
                <tr key={row.rowId} className={isTimeOff ? 'bg-green-50 hover:bg-green-100/70' : 'hover:bg-slate-50/50'}>
                  {/* Client */}
                  <td className="px-2 py-1.5">
                    <Combobox
                      value={row.clientId}
                      onChange={id => updateSelector(row.rowId, 'clientId', id)}
                      options={clients.map(c => ({ id: c.id, label: c.name }))}
                      placeholder="— client —"
                    />
                  </td>

                  {/* Project */}
                  <td className="px-2 py-1.5">
                    <Combobox
                      value={row.projectId ?? ''}
                      onChange={id => updateSelector(row.rowId, 'projectId', id || null)}
                      options={[
                        { id: '', label: 'None' },
                        ...projects.map(p => ({ id: p.id, label: p.name })),
                      ]}
                      placeholder="— none —"
                      disabled={!row.clientId || projects.length === 0}
                    />
                  </td>

                  {/* Task */}
                  <td className="px-2 py-1.5">
                    <Combobox
                      value={row.taskId}
                      onChange={id => updateSelector(row.rowId, 'taskId', id)}
                      options={clientTasks.map(t => ({ id: t.id, label: t.name, group: t.category }))}
                      placeholder="— task —"
                      disabled={!row.clientId}
                    />
                  </td>

                  {/* Notes */}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => openRowNotes(row.rowId)}
                      disabled={!rowHasEligibleDate}
                      title={rowHasEligibleDate ? 'Add or edit a note for this row' : 'Log hours before adding a note'}
                      className={[
                        'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        rowHasNote
                          ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500',
                      ].join(' ')}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                      </svg>
                      {rowHasNote ? 'Edit' : 'Add'}
                    </button>
                  </td>

                  {/* Hour inputs */}
                  {periodDates.map(date => {
                    const cellKey = `${row.rowId}|${date}`
                    const isSaving = saving.has(cellKey)
                    const hasError = errors.has(cellKey)
                    const isReady = Boolean(row.clientId && row.taskId)
                    const hasHours = (parseFloat(row.hours[date] ?? '') || 0) > 0
                    const hasNote = Boolean(row.notes[date])

                    return (
                      <td key={date} className="px-1 py-1.5">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            value={row.hours[date] ?? ''}
                            onChange={e => updateHoursLocal(row.rowId, date, e.target.value)}
                            onBlur={() => saveCell(row.rowId, date)}
                            disabled={!isReady}
                            placeholder="0"
                            title={hasError ? errors.get(cellKey) : undefined}
                            className={[
                              'w-14 rounded border px-1.5 py-1 text-center text-xs transition-colors',
                              'focus:outline-none focus:ring-1',
                              'disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed',
                              hasError
                                ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-300'
                                : isSaving
                                ? 'border-blue-300 bg-blue-50 focus:border-blue-400 focus:ring-blue-300'
                                : 'border-slate-200 focus:border-blue-400 focus:ring-blue-300',
                            ].join(' ')}
                          />
                          {hasHours && (
                            <button
                              onClick={() => openNoteEditor(row.rowId, date)}
                              title={row.notes[date] || 'Add note'}
                              className={[
                                'absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors',
                                hasNote
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'bg-white border-slate-300 text-slate-300 hover:border-blue-400 hover:text-blue-400',
                              ].join(' ')}
                            >
                              <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )
                  })}

                  {/* Row total */}
                  <td className="px-2 py-1.5 text-center text-xs font-semibold text-slate-600">
                    {formatHours(rowTotal)}
                  </td>

                  {/* Remove row */}
                  <td className="px-1 py-1.5 text-center">
                    <button
                      onClick={() => removeRow(row.rowId)}
                      title="Remove row"
                      className="text-slate-300 hover:text-red-400 transition-colors leading-none text-base"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td
                colSpan={3}
                className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                Daily Total
              </td>
              <td />
              {dayTotals.map((total, i) => {
                const clocked = clockedByDate[periodDates[i]] ?? 0
                const reconciled = clocked > 0 && Math.abs(total - clocked) < 0.01
                const mismatched = clocked > 0 && Math.abs(total - clocked) >= 0.01
                return (
                  <td
                    key={periodDates[i]}
                    title={
                      clocked > 0
                        ? reconciled
                          ? 'Matches clocked hours'
                          : `Clocked ${formatHours(clocked)}h, logged ${formatHours(total)}h`
                        : undefined
                    }
                    className={[
                      'px-2 py-2 text-center text-xs font-bold',
                      reconciled ? 'text-green-700 bg-green-50' : mismatched ? 'text-amber-700 bg-amber-50' : 'text-slate-700',
                    ].join(' ')}
                  >
                    {formatHours(total)}
                  </td>
                )
              })}
              <td className="px-2 py-2 text-center text-xs font-bold text-slate-900">
                {formatHours(periodTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add row */}
      <div className="mt-3">
        <button
          onClick={addRow}
          className="rounded border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          + Add row
        </button>
      </div>

      {/* Error summary */}
      {errors.size > 0 && (
        <p className="mt-3 text-xs text-red-600">
          Some cells failed to save. Hover the red cells for details.
        </p>
      )}

      {noteRow && (() => {
        const row = rows.find(r => r.rowId === noteRow.rowId)
        const dates = row ? eligibleNoteDates(row) : []
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200" style={{ backgroundColor: '#0B1460' }}>
                <h2 className="text-base font-bold text-white">Add Note</h2>
                <button onClick={() => setNoteRow(null)} className="text-white/70 hover:text-white transition-colors text-xl leading-none">
                  ×
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {dates.length === 0 ? (
                  <p className="text-sm text-slate-400">Log hours on this row before adding a note.</p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        Date
                      </label>
                      {noteRow.locked ? (
                        <p className="text-sm text-slate-700 font-medium">
                          {(() => {
                            const { day, shortDate } = formatDayHeader(new Date(noteRow.date + 'T00:00:00'))
                            return `${day} ${shortDate}`
                          })()}
                        </p>
                      ) : (
                        <select
                          value={noteRow.date}
                          onChange={e => changeNoteDate(e.target.value)}
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                        >
                          {dates.map(d => {
                            const { day, shortDate } = formatDayHeader(new Date(d + 'T00:00:00'))
                            return (
                              <option key={d} value={d}>
                                {day} {shortDate}
                              </option>
                            )
                          })}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        Note
                      </label>
                      <textarea
                        autoFocus
                        rows={4}
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        placeholder="What should we know about this entry?"
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setNoteRow(null)}
                    className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNote}
                    disabled={savingNote || dates.length === 0}
                    className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#0B1460' }}
                  >
                    {savingNote ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

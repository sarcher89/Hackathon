'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Client, Project, Task } from '@/types/database'
import { saveTimeEntry, clearRowEntries, getMyProjectLogWeeks, type MyWeekOption } from '@/app/actions/time-entries'
import { formatDayHeader, formatWeekRange } from '@/lib/dates'
import Combobox from '@/components/Combobox'

interface GridRow {
  rowId: string
  clientId: string
  projectId: string | null
  taskId: string
  hours: Record<string, string>
}

interface TimeGridProps {
  weekStart: string
  dates: string[]
  clients: Client[]
  projectsByClient: Record<string, Project[]>
  tasks: Task[]
  initialRows: GridRow[]
}

let rowSeq = 0
function nextRowId() {
  return `new-${++rowSeq}`
}

function emptyRow(): GridRow {
  return { rowId: nextRowId(), clientId: '', projectId: null, taskId: '', hours: {} }
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
  dates,
  clients,
  projectsByClient,
  tasks,
  initialRows,
}: TimeGridProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [rows, setRows] = useState<GridRow[]>(
    initialRows.length > 0 ? initialRows : [emptyRow()]
  )
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const [weekOptions, setWeekOptions] = useState<MyWeekOption[]>([])
  useEffect(() => {
    getMyProjectLogWeeks().then(setWeekOptions)
  }, [])

  const monday = new Date(weekStart + 'T00:00:00')
  const dayHeaders = dates.map(d => ({
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
        dates,
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
            dates,
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
    const hours = Math.max(0, parseFloat(raw) || 0)
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

  function handleWeekChange(next: string) {
    router.push(`${pathname}?week=${next}`)
  }

  const dayTotals = dates.map(date =>
    rows.reduce((sum, r) => sum + (parseFloat(r.hours[date] ?? '') || 0), 0)
  )
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Week selector */}
      <div className="mb-4 flex items-center justify-between">
        <select
          value={dates[0]}
          onChange={e => handleWeekChange(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {!weekOptions.some(w => w.weekStart === dates[0]) && (
            <option value={dates[0]}>{formatWeekRange(monday)}</option>
          )}
          {weekOptions.map(w => (
            <option key={w.weekStart} value={w.weekStart}>
              {w.label}
            </option>
          ))}
        </select>
        <span className="text-sm font-semibold text-slate-700">
          {formatWeekRange(monday)}
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
              {dayHeaders.map(h => (
                <th
                  key={h.isoDate}
                  className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-16"
                >
                  <div>{h.day}</div>
                  <div className="text-slate-400 normal-case font-normal">{h.shortDate}</div>
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
              const rowTotal = dates.reduce(
                (sum, d) => sum + (parseFloat(row.hours[d] ?? '') || 0),
                0
              )
              const clientTasks = getTasksForClient(tasks, clients, row.clientId)
              const projects = row.clientId ? (projectsByClient[row.clientId] ?? []) : []

              return (
                <tr key={row.rowId} className="hover:bg-slate-50/50">
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

                  {/* Hour inputs */}
                  {dates.map(date => {
                    const cellKey = `${row.rowId}|${date}`
                    const isSaving = saving.has(cellKey)
                    const hasError = errors.has(cellKey)
                    const isReady = Boolean(row.clientId && row.taskId)

                    return (
                      <td key={date} className="px-1 py-1.5">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
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
              {dayTotals.map((total, i) => (
                <td
                  key={dates[i]}
                  className="px-2 py-2 text-center text-xs font-bold text-slate-700"
                >
                  {formatHours(total)}
                </td>
              ))}
              <td className="px-2 py-2 text-center text-xs font-bold text-slate-900">
                {formatHours(weekTotal)}
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
    </div>
  )
}

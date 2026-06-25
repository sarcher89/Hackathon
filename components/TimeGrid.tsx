'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Client, Project, Task } from '@/types/database'
import { saveTimeEntry, clearRowEntries } from '@/app/actions/time-entries'
import { formatDayHeader, formatWeekRange, offsetWeek, toISODate } from '@/lib/dates'

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

function groupByCategory(tasks: Task[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {}
  for (const t of tasks) {
    if (!map[t.category]) map[t.category] = []
    map[t.category].push(t)
  }
  return map
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

  const [rows, setRows] = useState<GridRow[]>(
    initialRows.length > 0 ? initialRows : [emptyRow()]
  )
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

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

  function navigateWeek(offset: number) {
    const next = toISODate(offsetWeek(monday, offset))
    router.push(`/dashboard?week=${next}`)
  }

  const dayTotals = dates.map(date =>
    rows.reduce((sum, r) => sum + (parseFloat(r.hours[date] ?? '') || 0), 0)
  )
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0)

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
              const tasksByCategory = groupByCategory(clientTasks)
              const projects = row.clientId ? (projectsByClient[row.clientId] ?? []) : []

              return (
                <tr key={row.rowId} className="hover:bg-slate-50/50">
                  {/* Client */}
                  <td className="px-2 py-1.5">
                    <select
                      value={row.clientId}
                      onChange={e => updateSelector(row.rowId, 'clientId', e.target.value)}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="">— client —</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Project */}
                  <td className="px-2 py-1.5">
                    <select
                      value={row.projectId ?? ''}
                      onChange={e =>
                        updateSelector(row.rowId, 'projectId', e.target.value || null)
                      }
                      disabled={!row.clientId || projects.length === 0}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">— none —</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Task */}
                  <td className="px-2 py-1.5">
                    <select
                      value={row.taskId}
                      onChange={e => updateSelector(row.rowId, 'taskId', e.target.value)}
                      disabled={!row.clientId}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">— task —</option>
                      {Object.entries(tasksByCategory).map(([category, categoryTasks]) => (
                        <optgroup key={category} label={category}>
                          {categoryTasks.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
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

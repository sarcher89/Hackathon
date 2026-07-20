'use client'

import { useState } from 'react'
import { saveTimeEntry } from '@/app/actions/time-entries'
import { Client, Project, Task } from '@/types/database'
import Combobox from '@/components/Combobox'

interface AllocationRow {
  id: string
  clientId: string
  projectId: string | null
  taskId: string
  hours: string
}

interface Props {
  date: string
  totalHours: number
  clients: Client[]
  projectsByClient: Record<string, Project[]>
  tasks: Task[]
  onClose: () => void
  onSaved: () => void
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

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

let rowSeq = 0
function nextRowId(): string {
  return `alloc-${++rowSeq}`
}

export default function AttributeTimeModal({
  date,
  totalHours,
  clients,
  projectsByClient,
  tasks,
  onClose,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<AllocationRow[]>([
    { id: nextRowId(), clientId: '', projectId: null, taskId: '', hours: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allocated = rows.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0)
  const remaining = Math.round((totalHours - allocated) * 100) / 100
  const overAllocated = allocated > totalHours + 0.01
  const canSave =
    rows.length > 0 &&
    rows.every(r => r.clientId && r.taskId && (parseFloat(r.hours) || 0) > 0) &&
    !overAllocated

  function updateRow(id: string, patch: Partial<AllocationRow>) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows(prev => [
      ...prev,
      { id: nextRowId(), clientId: '', projectId: null, taskId: '', hours: '' },
    ])
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    for (const row of rows) {
      const result = await saveTimeEntry({
        clientId: row.clientId,
        projectId: row.projectId,
        taskId: row.taskId,
        date,
        hours: parseFloat(row.hours) || 0,
      })
      if (!result.success) {
        setError(result.error)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200" style={{ backgroundColor: '#0B1460' }}>
          <h2 className="text-base font-bold text-white">Attribute Your Time</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            You clocked <span className="font-semibold text-slate-800">{totalHours}h</span> on {formatDate(date)}.
            Attribute it to a client and task below so it shows up in your Project Log too.
          </p>

          <div className="space-y-3">
            {rows.map(row => {
              const clientTasks = getTasksForClient(tasks, clients, row.clientId)
              const projects = row.clientId ? (projectsByClient[row.clientId] ?? []) : []
              return (
                <div key={row.id}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Combobox
                        value={row.clientId}
                        onChange={id => updateRow(row.id, { clientId: id, projectId: null, taskId: '' })}
                        options={clients.map(c => ({ id: c.id, label: c.name }))}
                        placeholder="— client —"
                      />
                    </div>
                    {projects.length > 0 && (
                      <div className="flex-1">
                        <Combobox
                          value={row.projectId ?? ''}
                          onChange={id => updateRow(row.id, { projectId: id || null })}
                          options={[{ id: '', label: 'None' }, ...projects.map(p => ({ id: p.id, label: p.name }))]}
                          placeholder="— project —"
                          disabled={!row.clientId}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <Combobox
                        value={row.taskId}
                        onChange={id => updateRow(row.id, { taskId: id })}
                        options={clientTasks.map(t => ({ id: t.id, label: t.name, group: t.category }))}
                        placeholder="— task —"
                        disabled={!row.clientId}
                      />
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={totalHours}
                      step="0.25"
                      value={row.hours}
                      onChange={e => updateRow(row.id, { hours: e.target.value })}
                      className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                    />
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {remaining > 0.01 && (
            <button onClick={addRow} className="text-sm font-medium hover:underline" style={{ color: '#0B1460' }}>
              + Split remaining {remaining}h across another client/task
            </button>
          )}

          {overAllocated && (
            <p className="text-xs text-red-600 font-medium">
              Allocated hours exceed the {totalHours}h you clocked.
            </p>
          )}
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#0B1460' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

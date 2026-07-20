'use client'

import { useState } from 'react'
import { saveClockSessionNote } from '@/app/actions/clock'
import { ClockSessionRow } from '@/components/TimeSheet'

interface Props {
  sessions: ClockSessionRow[]
  preselectedSessionId?: string
  onClose: () => void
  onSaved: () => void
}

function formatSessionLabel(s: ClockSessionRow): string {
  const d = new Date(s.date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const inTime = new Date(s.clockedInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const outTime = s.clockedOutAt
    ? new Date(s.clockedOutAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'Currently clocked in'
  return `${dateLabel} · ${inTime} – ${outTime}`
}

export default function AddSessionNoteModal({ sessions, preselectedSessionId, onClose, onSaved }: Props) {
  const sortedSessions = [...sessions].sort((a, b) => b.clockedInAt.localeCompare(a.clockedInAt))
  const [sessionId, setSessionId] = useState(preselectedSessionId ?? sortedSessions[0]?.id ?? '')
  const [note, setNote] = useState(sortedSessions.find(s => s.id === sessionId)?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locked = Boolean(preselectedSessionId)

  function handleSessionChange(id: string) {
    setSessionId(id)
    setNote(sortedSessions.find(s => s.id === id)?.notes ?? '')
  }

  async function handleSave() {
    if (!sessionId) return
    setSaving(true)
    setError(null)
    const result = await saveClockSessionNote(sessionId, note)
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200" style={{ backgroundColor: '#0B1460' }}>
          <h2 className="text-base font-bold text-white">Add Note</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {sortedSessions.length === 0 ? (
            <p className="text-sm text-slate-400">No clock sessions to add a note to yet.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Session
                </label>
                {locked ? (
                  <p className="text-sm text-slate-700 font-medium">
                    {formatSessionLabel(sortedSessions.find(s => s.id === sessionId)!)}
                  </p>
                ) : (
                  <select
                    value={sessionId}
                    onChange={e => handleSessionChange(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                  >
                    {sortedSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {formatSessionLabel(s)}
                      </option>
                    ))}
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
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="What should we know about this session?"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !sessionId}
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

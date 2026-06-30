'use client'

import { useState } from 'react'
import { submitTimeOffRequest, TimeOffEntry } from '@/app/actions/timeoff'
import { TimeOffType } from '@/types/database'

interface Balances {
  vacation_hours: number
  sick_hours: number
  bereavement_hours: number
}

interface Props {
  balances: Balances
  onClose: () => void
}

const TYPE_LABELS: Record<TimeOffType, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  bereavement: 'Bereavement',
}

const BALANCE_KEY: Record<TimeOffType, keyof Balances> = {
  vacation: 'vacation_hours',
  sick: 'sick_hours',
  bereavement: 'bereavement_hours',
}

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function TimeOffModal({ balances, onClose }: Props) {
  const [entries, setEntries] = useState<TimeOffEntry[]>([
    { date: today(), hours: 8, type: 'vacation' },
  ])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function updateEntry(index: number, patch: Partial<TimeOffEntry>) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e))
  }

  function addEntry() {
    setEntries(prev => [...prev, { date: today(), hours: 8, type: 'vacation' }])
  }

  function removeEntry(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (entries.length === 0) return
    setLoading(true)
    setError(null)
    const result = await submitTimeOffRequest(entries, notes || undefined)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200" style={{ backgroundColor: '#0B1460' }}>
          <h2 className="text-base font-bold text-white">Request Time Off</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-base font-semibold text-slate-800">Request submitted</p>
            <p className="text-sm text-slate-500 mt-1">Your leader will be notified.</p>
            <button
              onClick={onClose}
              className="mt-6 rounded-lg px-6 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0B1460' }}
            >
              Close
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Balances */}
            <div className="grid grid-cols-3 gap-3">
              {(['vacation', 'sick', 'bereavement'] as TimeOffType[]).map(t => (
                <div key={t} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-800">{balances[BALANCE_KEY[t]]}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{TYPE_LABELS[t]} hrs</p>
                </div>
              ))}
            </div>

            {/* Entries */}
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={entry.date}
                    onChange={e => updateEntry(i, { date: e.target.value })}
                    className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                  />
                  <select
                    value={entry.hours}
                    onChange={e => updateEntry(i, { hours: Number(e.target.value) })}
                    className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                  >
                    {HOUR_OPTIONS.map(h => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </select>
                  <select
                    value={entry.type}
                    onChange={e => updateEntry(i, { type: e.target.value as TimeOffType })}
                    className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-900/30"
                  >
                    {(Object.keys(TYPE_LABELS) as TimeOffType[]).map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeEntry(i)}
                      className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addEntry}
              className="text-sm font-medium hover:underline"
              style={{ color: '#0B1460' }}
            >
              + Add another date
            </button>

            {/* Notes */}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-900/30 resize-none"
            />

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || entries.length === 0}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#0B1460' }}
              >
                {loading ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

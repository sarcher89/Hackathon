'use client'

import { useState } from 'react'
import { User } from '@/types/database'
import { setUserWage, updateUserProfile } from '@/app/actions/payroll'

const DEPARTMENTS = ['Legwork Web Team', 'Legwork Marketing']

interface Props {
  users: User[]
}

interface EditState {
  full_name: string
  department: string
  hourly_wage: string
}

export default function WageManager({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditState>({ full_name: '', department: '', hourly_wage: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(u: User) {
    setEditing(u.id)
    setDraft({
      full_name: u.full_name || '',
      department: u.department || '',
      hourly_wage: String(u.hourly_wage || ''),
    })
    setError(null)
  }

  function cancel() {
    setEditing(null)
    setError(null)
  }

  async function handleSave(userId: string) {
    setSaving(true)
    setError(null)

    const wage = parseFloat(draft.hourly_wage)
    const profileResult = await updateUserProfile(userId, {
      full_name: draft.full_name.trim(),
      department: draft.department,
    })

    if (!profileResult.success) {
      setError(profileResult.error ?? 'Save failed')
      setSaving(false)
      return
    }

    if (!isNaN(wage) && wage >= 0) {
      const wageResult = await setUserWage(userId, wage)
      if (!wageResult.success) {
        setError(wageResult.error ?? 'Wage save failed')
        setSaving(false)
        return
      }
    }

    setUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? {
              ...u,
              full_name: draft.full_name.trim(),
              department: draft.department,
              hourly_wage: !isNaN(wage) ? wage : u.hourly_wage,
            }
          : u
      )
    )
    setEditing(null)
    setSaving(false)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Hourly Wage</th>
            <th className="w-32" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map(u => {
            const isEditing = editing === u.id
            return (
              <tr key={u.id} className="hover:bg-slate-50/50">
                {/* Name */}
                <td className="px-4 py-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={draft.full_name}
                      onChange={e => setDraft(d => ({ ...d, full_name: e.target.value }))}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  ) : (
                    <>
                      <div className="text-sm font-medium text-slate-800">{u.full_name || '—'}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </>
                  )}
                </td>

                {/* Department */}
                <td className="px-4 py-3">
                  {isEditing ? (
                    <select
                      value={draft.department}
                      onChange={e => setDraft(d => ({ ...d, department: e.target.value }))}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    >
                      <option value="">— Select —</option>
                      {DEPARTMENTS.map(dep => (
                        <option key={dep} value={dep}>{dep}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-600">{u.department || <span className="text-slate-300">—</span>}</span>
                  )}
                </td>

                {/* Role */}
                <td className="px-4 py-3 text-sm text-slate-600 capitalize">{u.role}</td>

                {/* Hourly Wage */}
                <td className="px-4 py-3 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.hourly_wage}
                      onChange={e => setDraft(d => ({ ...d, hourly_wage: e.target.value }))}
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-700">
                      {u.hourly_wage > 0 ? `$${u.hourly_wage.toFixed(2)}/hr` : '—'}
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  {isEditing ? (
                    <div className="flex flex-col gap-1 items-end">
                      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(u.id)}
                          disabled={saving}
                          className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancel}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(u)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { User } from '@/types/database'
import { setUserWage } from '@/app/actions/payroll'

interface Props {
  users: User[]
}

export default function WageManager({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(userId: string) {
    const wage = parseFloat(draft)
    if (isNaN(wage) || wage < 0) return
    setSaving(true)
    const result = await setUserWage(userId, wage)
    if (result.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, hourly_wage: wage } : u))
      setEditing(null)
    }
    setSaving(false)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Employee
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Role
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Hourly Wage
            </th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map(u => (
            <tr key={u.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-slate-800">{u.full_name || '—'}</div>
                <div className="text-xs text-slate-400">{u.email}</div>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 capitalize">{u.role}</td>
              <td className="px-4 py-3 text-right">
                {editing === u.id ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSave(u.id)
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    autoFocus
                    className="w-24 rounded border border-blue-400 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-700">
                    {u.hourly_wage > 0 ? `$${u.hourly_wage.toFixed(2)}/hr` : '—'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {editing === u.id ? (
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleSave(u.id)}
                      disabled={saving}
                      className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditing(u.id); setDraft(String(u.hourly_wage || '')) }}
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

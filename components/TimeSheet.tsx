'use client'

import { useRouter } from 'next/navigation'
import { formatWeekRange, offsetWeek, toISODate } from '@/lib/dates'

export interface ClockSessionRow {
  id: string
  date: string
  clockedInAt: string
  clockedOutAt: string | null
  hours: number | null
}

interface Props {
  weekStart: string
  sessions: ClockSessionRow[]
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function TimeSheet({ weekStart, sessions }: Props) {
  const router = useRouter()
  const monday = new Date(weekStart + 'T00:00:00')

  function navigateWeek(offset: number) {
    const next = toISODate(offsetWeek(monday, offset))
    router.push(`/dashboard?week=${next}`)
  }

  const weekTotal = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)

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

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Date
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                From
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                To
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Hours
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                  No sessions logged this week.
                </td>
              </tr>
            ) : (
              sessions.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                    {formatDate(s.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatTime(s.clockedInAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {s.clockedOutAt ? formatTime(s.clockedOutAt) : (
                      <span className="text-blue-500 font-medium">In progress</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right font-medium">
                    {s.hours !== null ? `${s.hours} hrs` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {sessions.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Week Total
                </td>
                <td className="px-4 py-2 text-sm font-bold text-slate-800 text-right">
                  {weekTotal} hrs
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { getPeriodStart, getPeriodDates, offsetPeriod, formatPeriodRange, toISODate } from '@/lib/dates'
import { ClockSessionRow } from '@/components/TimeSheet'

interface Props {
  weekStart: string
  userName: string
  userEmail: string
  hourlyWage: number
  sessions: ClockSessionRow[]
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PayStub({ weekStart, userName, userEmail, hourlyWage, sessions }: Props) {
  const router = useRouter()
  const periodStart = getPeriodStart(new Date(weekStart + 'T00:00:00'))
  const periodDates = getPeriodDates(periodStart)
  const periodEnd = periodDates[periodDates.length - 1]

  const completedSessions = sessions.filter(s => s.clockedOutAt !== null)
  const totalHours = completedSessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const grossPay = totalHours * hourlyWage

  const periodLabel = formatPeriodRange(periodStart)
  const checkDate = periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  function navigateWeek(offset: number) {
    const next = toISODate(offsetPeriod(periodStart, offset))
    router.push(`/dashboard?week=${next}`)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div>
      {/* Week navigation — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigateWeek(-1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ← Prev
        </button>
        <span className="text-sm font-semibold text-slate-700">{periodLabel}</span>
        <button
          onClick={() => navigateWeek(1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Pay stub card */}
      <div id="pay-stub" className="rounded-lg border border-slate-200 bg-white shadow-sm p-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Pay Stub</h3>
            <p className="text-sm text-slate-500 mt-1">Period: {periodLabel}</p>
            <p className="text-sm text-slate-500">Check Date: {checkDate}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{userName}</p>
            <p className="text-xs text-slate-400">{userEmail}</p>
          </div>
        </div>

        {hourlyWage === 0 && (
          <p className="mb-4 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
            Hourly wage not set — contact your leader.
          </p>
        )}

        {/* Daily breakdown */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
              <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">From</th>
              <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">To</th>
              <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Hours</th>
              <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {completedSessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                  No completed sessions this week.
                </td>
              </tr>
            ) : (
              completedSessions.map(s => (
                <tr key={s.id}>
                  <td className="py-2 text-slate-700">{formatDate(s.date)}</td>
                  <td className="py-2 text-slate-600">{formatTime(s.clockedInAt)}</td>
                  <td className="py-2 text-slate-600">{formatTime(s.clockedOutAt!)}</td>
                  <td className="py-2 text-right text-slate-700">{fmt(s.hours ?? 0)}</td>
                  <td className="py-2 text-right text-slate-700">
                    {hourlyWage > 0 ? `$${fmt((s.hours ?? 0) * hourlyWage)}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Earnings summary */}
        <div className="border-t-2 border-slate-300 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Total Hours</span>
            <span className="font-semibold text-slate-800">{fmt(totalHours)} hrs</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Hourly Rate</span>
            <span className="font-semibold text-slate-800">
              {hourlyWage > 0 ? `$${fmt(hourlyWage)}/hr` : '—'}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-2">
            <span className="text-slate-800">Gross Pay</span>
            <span className="text-slate-900">
              {hourlyWage > 0 ? `$${fmt(grossPay)}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Print button */}
      <div className="mt-4 print:hidden">
        <button
          onClick={handlePrint}
          className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ↓ Download / Print PDF
        </button>
      </div>
    </div>
  )
}

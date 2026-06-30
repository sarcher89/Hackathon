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
  compact?: boolean
}

const DAY_ABBR = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function formatTimeParts(iso: string): { hhmm: string; ampm: string } {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return {
    hhmm: `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    ampm,
  }
}

function fmtHrs(n: number): string {
  return n.toFixed(2)
}

function TimeCell({ iso }: { iso: string }) {
  const parts = formatTimeParts(iso)
  return (
    <div className="flex items-center gap-1">
      <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 min-w-[46px] text-center">
        {parts.hhmm}
      </span>
      <span className="text-xs text-slate-400">{parts.ampm}</span>
    </div>
  )
}

export default function TimeSheet({ weekStart, sessions, compact }: Props) {
  const router = useRouter()
  const monday = new Date(weekStart + 'T00:00:00')

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    const iso = toISODate(d)
    return {
      iso,
      label: `${DAY_ABBR[i]} ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`,
      isWeekend: i >= 5,
    }
  })

  // Group sessions by date; sessions already ordered by clocked_in_at asc
  const byDate: Record<string, ClockSessionRow[]> = {}
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  }

  function navigateWeek(offset: number) {
    const next = toISODate(offsetWeek(monday, offset))
    router.push(`/dashboard?week=${next}`)
  }

  const weekTotal = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigateWeek(-1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          &larr; Prev
        </button>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 leading-none">
              {fmtHrs(weekTotal)} <span className="text-base font-semibold text-slate-500">hrs</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Total</p>
          </div>
          <span className="text-sm font-semibold text-slate-600">{formatWeekRange(monday)}</span>
        </div>

        <button
          onClick={() => navigateWeek(1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Next &rarr;
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left min-w-[148px]">Date</th>
              <th className="px-3 py-2.5 text-left min-w-[110px]">In</th>
              <th className="px-3 py-2.5 text-left min-w-[110px]">Out</th>
              <th className="px-3 py-2.5 text-right w-24">Total</th>
              {!compact && <th className="w-10 px-2 py-2.5 text-center">Notes</th>}
            </tr>
          </thead>

          <tbody>
            {weekDays.map(day => {
              const daySessions = byDate[day.iso] ?? []
              const hasEntries = daySessions.length > 0
              const isWeekend = day.isWeekend

              const firstIn = hasEntries ? daySessions[0].clockedInAt : null
              // Last session that has a clock-out
              const lastOut = hasEntries
                ? [...daySessions].reverse().find(s => s.clockedOutAt != null)?.clockedOutAt ?? null
                : null
              const anyInProgress = hasEntries && daySessions.some(s => s.clockedOutAt === null)
              const dayTotal = daySessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)

              return (
                <tr
                  key={day.iso}
                  className={[
                    'border-t border-slate-200',
                    isWeekend ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/40',
                  ].join(' ')}
                >
                  {/* Date */}
                  <td className="px-3 py-3">
                    <p className={`font-semibold text-sm ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                      {day.label}
                    </p>
                  </td>

                  {/* In */}
                  <td className="px-3 py-3">
                    {firstIn ? <TimeCell iso={firstIn} /> : <span className="text-sm text-slate-300">—</span>}
                  </td>

                  {/* Out */}
                  <td className="px-3 py-3">
                    {lastOut ? (
                      <TimeCell iso={lastOut} />
                    ) : anyInProgress ? (
                      <span className="text-xs text-blue-500 font-medium">In progress</span>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="px-3 py-3 text-right">
                    {hasEntries ? (
                      <span className={`text-sm font-semibold ${isWeekend ? 'text-slate-400' : 'text-slate-600'}`}>
                        {fmtHrs(dayTotal)} hrs
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {!compact && <td />}
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Week Total
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-800">
                {fmtHrs(weekTotal)} hrs
              </td>
              {!compact && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

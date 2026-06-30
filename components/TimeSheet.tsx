'use client'

import { useState } from 'react'
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

export default function TimeSheet({ weekStart, sessions }: Props) {
  const router = useRouter()
  const monday = new Date(weekStart + 'T00:00:00')

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    const iso = toISODate(d)
    return {
      iso,
      abbr: DAY_ABBR[i],
      label: `${DAY_ABBR[i]} ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`,
      isWeekend: i >= 5,
    }
  })

  const byDate: Record<string, ClockSessionRow[]> = {}
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  }

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  function toggleDay(iso: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  function navigateWeek(offset: number) {
    const next = toISODate(offsetWeek(monday, offset))
    router.push(`/dashboard?week=${next}`)
  }

  const weekTotal = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)

  const COL_SPAN = 7

  return (
    <div>
      {/* Header: total + navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigateWeek(-1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ← Prev
        </button>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 leading-none">{fmtHrs(weekTotal)} <span className="text-base font-semibold text-slate-500">hrs</span></p>
            <p className="text-xs text-slate-400 mt-0.5">Total</p>
          </div>
          <span className="text-sm font-semibold text-slate-600">{formatWeekRange(monday)}</span>
        </div>

        <button
          onClick={() => navigateWeek(1)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Next →
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 text-left min-w-[148px]">Date</th>
              <th className="w-8 px-1 py-2.5" />
              <th className="w-7 px-1 py-2.5" />
              <th className="px-3 py-2.5 text-left min-w-[110px]">From</th>
              <th className="px-3 py-2.5 text-left min-w-[110px]">To</th>
              <th className="px-3 py-2.5 text-right w-24">Raw Total</th>
              <th className="px-3 py-2.5 text-right w-24">Calc. Total</th>
              <th className="w-10 px-2 py-2.5 text-center">Notes</th>
            </tr>
          </thead>

          <tbody>
            {weekDays.map(day => {
              const daySessions = byDate[day.iso] ?? []
              const dayTotal = daySessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
              const isCollapsed = collapsed.has(day.iso)
              const hasEntries = daySessions.length > 0
              const isWeekend = day.isWeekend

              return [
                /* Day header row */
                <tr
                  key={`hdr-${day.iso}`}
                  className={[
                    'border-t border-slate-200 group',
                    isWeekend ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/40',
                  ].join(' ')}
                >
                  {/* Chevron */}
                  <td className="px-2 py-2.5 text-center">
                    {hasEntries && (
                      <button
                        onClick={() => toggleDay(day.iso)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                          viewBox="0 0 16 16" fill="currentColor"
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </td>

                  {/* Day label */}
                  <td className="px-3 py-2.5">
                    <p className={`font-semibold text-sm ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                      {day.label}
                    </p>
                    {!isWeekend && (
                      <p className="text-xs text-blue-400 mt-0.5">No Schedule</p>
                    )}
                  </td>

                  {/* Clock icon */}
                  <td className="px-1 py-2.5 text-center">
                    {hasEntries && (
                      <svg className="w-4 h-4 text-slate-400 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </td>

                  {/* Add (+) */}
                  <td className="px-1 py-2.5 text-center">
                    {!isWeekend && (
                      <button className="w-5 h-5 rounded-full border border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center mx-auto transition-colors text-xs leading-none">
                        +
                      </button>
                    )}
                  </td>

                  {/* From / To — empty on header */}
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />

                  {/* Raw Total */}
                  <td className="px-3 py-2.5 text-right">
                    {hasEntries && (
                      <span className={`text-sm font-semibold ${isWeekend ? 'text-slate-400' : 'text-slate-600'}`}>
                        {fmtHrs(dayTotal)} hrs
                      </span>
                    )}
                    {!hasEntries && (
                      <span className="text-sm text-slate-300">0.00 hrs</span>
                    )}
                  </td>

                  {/* Calc. Total */}
                  <td className="px-3 py-2.5 text-right">
                    {hasEntries && (
                      <span className={`text-sm font-semibold ${isWeekend ? 'text-slate-400' : 'text-slate-600'}`}>
                        {fmtHrs(dayTotal)} hrs
                      </span>
                    )}
                    {!hasEntries && (
                      <span className="text-sm text-slate-300">0.00 hrs</span>
                    )}
                  </td>

                  <td />
                </tr>,

                /* Entry rows */
                ...(hasEntries && !isCollapsed
                  ? daySessions.map(s => {
                      const inParts = formatTimeParts(s.clockedInAt)
                      const outParts = s.clockedOutAt ? formatTimeParts(s.clockedOutAt) : null

                      return (
                        <tr key={s.id} className="border-t border-slate-100 bg-white hover:bg-slate-50/50">
                          {/* indent */}
                          <td />
                          {/* empty date col */}
                          <td className="px-3 py-2" />
                          {/* clock icon */}
                          <td className="px-1 py-2 text-center">
                            <svg className="w-3.5 h-3.5 text-slate-300 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </td>
                          <td />

                          {/* From */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 min-w-[46px] text-center">
                                {inParts.hhmm}
                              </span>
                              <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">
                                {inParts.ampm}
                              </span>
                            </div>
                          </td>

                          {/* To */}
                          <td className="px-3 py-2">
                            {outParts ? (
                              <div className="flex items-center gap-1">
                                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 min-w-[46px] text-center">
                                  {outParts.hhmm}
                                </span>
                                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">
                                  {outParts.ampm}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-blue-500 font-medium">In progress</span>
                            )}
                          </td>

                          {/* Raw Total */}
                          <td className="px-3 py-2 text-right">
                            <span className="text-xs text-slate-600">
                              {s.hours !== null ? fmtHrs(s.hours) : '—'}
                            </span>
                          </td>

                          {/* Calc. Total */}
                          <td className="px-3 py-2 text-right">
                            <span className="text-xs text-slate-600">
                              {s.hours !== null ? fmtHrs(s.hours) : '—'}
                            </span>
                          </td>

                          {/* Notes */}
                          <td className="px-2 py-2 text-center">
                            <button className="text-slate-300 hover:text-slate-500 transition-colors">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  : []),
              ]
            })}
          </tbody>

          {/* Week total footer */}
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td colSpan={6} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Week Total
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-800">
                {fmtHrs(weekTotal)} hrs
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-800">
                {fmtHrs(weekTotal)} hrs
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

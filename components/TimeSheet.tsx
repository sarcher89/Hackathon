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

  const byDate: Record<string, ClockSessionRow[]> = {}
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  }

  // Default all days to collapsed
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggleDay(iso: string) {
    setExpanded(prev => {
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

  const colSpan = compact ? 4 : 5

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
              <th className="w-8 px-2 py-2.5" />
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
              const isExpanded = expanded.has(day.iso)

              const firstIn = hasEntries ? daySessions[0].clockedInAt : null
              const lastOut = hasEntries
                ? [...daySessions].reverse().find(s => s.clockedOutAt != null)?.clockedOutAt ?? null
                : null
              const anyInProgress = hasEntries && daySessions.some(s => s.clockedOutAt === null)
              const dayTotal = daySessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)

              return [
                <tr
                  key={`hdr-${day.iso}`}
                  className={[
                    'border-t border-slate-200',
                    isWeekend ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/40',
                    hasEntries ? 'cursor-pointer' : '',
                  ].join(' ')}
                  onClick={() => hasEntries && toggleDay(day.iso)}
                >
                  {/* Chevron */}
                  <td className="px-2 py-2.5 text-center">
                    {hasEntries && (
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform mx-auto ${isExpanded ? '' : '-rotate-90'}`}
                        viewBox="0 0 16 16" fill="currentColor"
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-3 py-2.5">
                    <p className={`font-semibold text-sm ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                      {day.label}
                    </p>
                  </td>

                  {/* In */}
                  <td className="px-3 py-2.5">
                    {firstIn ? (
                      <TimeCell iso={firstIn} />
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {/* Out */}
                  <td className="px-3 py-2.5">
                    {lastOut ? (
                      <TimeCell iso={lastOut} />
                    ) : anyInProgress ? (
                      <span className="text-xs font-medium text-green-600">Currently Clocked In</span>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="px-3 py-2.5 text-right">
                    {hasEntries ? (
                      <span className={`text-sm font-semibold ${isWeekend ? 'text-slate-400' : 'text-slate-600'}`}>
                        {fmtHrs(dayTotal)} hrs
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {!compact && <td />}
                </tr>,

                /* Expanded session rows */
                ...(hasEntries && isExpanded
                  ? daySessions.map(s => {
                      const inParts = formatTimeParts(s.clockedInAt)
                      const outParts = s.clockedOutAt ? formatTimeParts(s.clockedOutAt) : null
                      const isActive = s.clockedOutAt === null

                      return (
                        <tr key={s.id} className="border-t border-slate-100 bg-slate-50/40">
                          <td />
                          <td className="px-3 py-2 pl-8 text-xs text-slate-400 italic">session</td>

                          {/* In */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 min-w-[46px] text-center">
                                {inParts.hhmm}
                              </span>
                              <span className="text-xs text-slate-400">{inParts.ampm}</span>
                            </div>
                          </td>

                          {/* Out */}
                          <td className="px-3 py-2">
                            {outParts ? (
                              <div className="flex items-center gap-1">
                                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 min-w-[46px] text-center">
                                  {outParts.hhmm}
                                </span>
                                <span className="text-xs text-slate-400">{outParts.ampm}</span>
                              </div>
                            ) : isActive ? (
                              <span className="text-xs font-medium text-green-600">Currently Clocked In</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>

                          {/* Total */}
                          <td className="px-3 py-2 text-right">
                            <span className="text-xs text-slate-500">
                              {s.hours !== null ? `${fmtHrs(s.hours)} hrs` : '—'}
                            </span>
                          </td>

                          {!compact && (
                            <td className="px-2 py-2 text-center">
                              <button className="text-slate-300 hover:text-slate-500 transition-colors">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  : []),
              ]
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td colSpan={colSpan - 1} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
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

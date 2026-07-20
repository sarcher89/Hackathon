'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getPeriodStart, getPeriodDates, formatPeriodRange, toISODate } from '@/lib/dates'
import { getMyPayPeriods, type MyPayPeriodOption } from '@/app/actions/clock'
import { getMyTimeOffRequests, type MyTimeOffRequest } from '@/app/actions/timeoff'
import { TIME_OFF_TYPE_LABEL } from '@/lib/timeoff'
import AddSessionNoteModal from '@/components/AddSessionNoteModal'

export interface ClockSessionRow {
  id: string
  date: string
  clockedInAt: string
  clockedOutAt: string | null
  hours: number | null
  notes: string | null
}

interface Props {
  weekStart: string
  sessions: ClockSessionRow[]
  compact?: boolean
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  const pathname = usePathname()

  const periodStart = getPeriodStart(new Date(weekStart + 'T00:00:00'))
  const periodDates = getPeriodDates(periodStart)

  const [periodOptions, setPeriodOptions] = useState<MyPayPeriodOption[]>([])
  useEffect(() => {
    if (compact) return
    getMyPayPeriods().then(setPeriodOptions)
  }, [compact])

  const [approvedTimeOff, setApprovedTimeOff] = useState<Map<string, MyTimeOffRequest>>(new Map())
  useEffect(() => {
    getMyTimeOffRequests().then(data => {
      const map = new Map<string, MyTimeOffRequest>()
      for (const r of data) {
        if (r.status === 'approved') map.set(r.date, r)
      }
      setApprovedTimeOff(map)
    })
  }, [])

  const byDate: Record<string, ClockSessionRow[]> = {}
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  }

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [noteSessionId, setNoteSessionId] = useState<string | null>(null)
  function toggleDay(iso: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  function handlePeriodChange(next: string) {
    router.push(`${pathname}?week=${next}`)
  }

  const todayIso = toISODate(new Date())
  const periodDateSet = new Set(periodDates.map(toISODate))
  const periodTimeOffHours = Array.from(approvedTimeOff.entries())
    .filter(([date]) => periodDateSet.has(date))
    .reduce((sum, [, r]) => sum + r.hours, 0)
  const periodTotal = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0) + periodTimeOffHours

  const ROW_PY = 'py-2.5'

  return (
    <div>
      {compact ? (
        <div
          className="sticky top-0 z-10 mb-4 flex items-center justify-between px-4 py-5"
          style={{ backgroundColor: '#0B1460' }}
        >
          <span className="text-sm font-semibold text-white">{formatPeriodRange(periodStart)}</span>
          <div className="text-center">
            <p className="text-2xl font-bold text-white leading-none">
              {fmtHrs(periodTotal)} <span className="text-base font-semibold text-white/70">hrs</span>
            </p>
            <p className="text-xs text-white/60 mt-0.5">Total</p>
          </div>
        </div>
      ) : (
        <div className="sticky top-0 z-10 bg-white mb-4 flex items-center justify-between px-1 py-2 border-b border-slate-100">
          <select
            value={toISODate(periodStart)}
            onChange={e => handlePeriodChange(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {!periodOptions.some(p => p.periodStart === toISODate(periodStart)) && (
              <option value={toISODate(periodStart)}>{formatPeriodRange(periodStart)}</option>
            )}
            {periodOptions.map(p => (
              <option key={p.periodStart} value={p.periodStart}>
                {p.label}
              </option>
            ))}
          </select>

          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800 leading-none">
              {fmtHrs(periodTotal)} <span className="text-base font-semibold text-slate-500">hrs</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Total</p>
          </div>
        </div>
      )}

      <div className={compact ? 'px-2' : ''}>
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
            {periodDates.map(date => {
              const iso = toISODate(date)
              const daySessions = byDate[iso] ?? []
              const hasEntries = daySessions.length > 0
              const timeOff = approvedTimeOff.get(iso)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const isExpanded = expanded.has(iso)

              const firstIn = hasEntries ? daySessions[0].clockedInAt : null
              const lastOut = hasEntries
                ? [...daySessions].reverse().find(s => s.clockedOutAt != null)?.clockedOutAt ?? null
                : null
              const anyInProgress = hasEntries && daySessions.some(s => s.clockedOutAt === null)
              const workedHours = daySessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
              const dayTotal = (timeOff?.hours ?? 0) + workedHours

              const dayLabel = `${DAY_ABBR[date.getDay()]} ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`
              const isCompleted = Boolean(timeOff) || (hasEntries && !anyInProgress)
              const isToday = iso === todayIso
              const isTodayActive = isToday && anyInProgress

              return [
                <tr
                  key={`hdr-${iso}`}
                  className={[
                    'border-t border-slate-200',
                    isTodayActive
                      ? 'today-stripes'
                      : timeOff || isCompleted
                      ? 'bg-green-50 hover:bg-green-100/70'
                      : isWeekend
                      ? 'bg-slate-50/60'
                      : 'bg-white hover:bg-slate-50/40',
                    hasEntries ? 'cursor-pointer' : '',
                  ].join(' ')}
                  onClick={() => hasEntries && toggleDay(iso)}
                >
                  <td className={`px-2 ${ROW_PY} text-center`}>
                    {hasEntries && (
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform mx-auto ${isExpanded ? '' : '-rotate-90'}`}
                        viewBox="0 0 16 16" fill="currentColor"
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </td>

                  <td className={`px-3 ${ROW_PY}`}>
                    <p className={`font-semibold text-sm ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                      {dayLabel}
                    </p>
                    {timeOff && (
                      <p className="text-xs font-medium text-green-700 mt-0.5">
                        {TIME_OFF_TYPE_LABEL[timeOff.type]} Time Off ({fmtHrs(timeOff.hours)}h)
                      </p>
                    )}
                  </td>

                  {/* In — always first clock-in time, on top of any time off */}
                  <td className={`px-3 ${ROW_PY}`}>
                    {firstIn ? (
                      <TimeCell iso={firstIn} />
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {/* Out — last clock-out, or "Currently Clocked In" if active */}
                  <td className={`px-3 ${ROW_PY}`}>
                    {anyInProgress ? (
                      <span className="text-xs font-medium text-green-600">Currently Clocked In</span>
                    ) : lastOut ? (
                      <TimeCell iso={lastOut} />
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  <td className={`px-3 ${ROW_PY} text-right`}>
                    {hasEntries || timeOff ? (
                      <span className={`text-sm font-semibold ${isWeekend ? 'text-slate-400' : 'text-slate-600'}`}>
                        {fmtHrs(dayTotal)} hrs
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>

                  {!compact && <td />}
                </tr>,

                ...(hasEntries && isExpanded
                  ? daySessions.map(s => {
                      const inParts = formatTimeParts(s.clockedInAt)
                      const outParts = s.clockedOutAt ? formatTimeParts(s.clockedOutAt) : null
                      const isActive = s.clockedOutAt === null

                      return (
                        <tr key={s.id} className="border-t border-slate-100 bg-slate-50/40">
                          <td />
                          <td className={`px-3 ${ROW_PY} pl-8 text-xs text-slate-400 italic`}>session</td>

                          {/* In */}
                          <td className={`px-3 ${ROW_PY}`}>
                            <div className="flex items-center gap-1">
                              <span className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 min-w-[46px] text-center">
                                {inParts.hhmm}
                              </span>
                              <span className="text-xs text-slate-400">{inParts.ampm}</span>
                            </div>
                          </td>

                          {/* Out */}
                          <td className={`px-3 ${ROW_PY}`}>
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

                          <td className={`px-3 ${ROW_PY} text-right`}>
                            <span className="text-xs text-slate-500">
                              {s.hours !== null ? `${fmtHrs(s.hours)} hrs` : '—'}
                            </span>
                          </td>

                          {!compact && (
                            <td className={`px-2 ${ROW_PY} text-center`}>
                              <button
                                onClick={() => setNoteSessionId(s.id)}
                                title={s.notes ?? 'Add note'}
                                className={s.notes ? 'text-blue-500 hover:text-blue-700 transition-colors' : 'text-slate-300 hover:text-slate-500 transition-colors'}
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={s.notes ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
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
              <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Period Total
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-bold text-slate-800">
                {fmtHrs(periodTotal)} hrs
              </td>
              {!compact && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      </div>

      {noteSessionId && (
        <AddSessionNoteModal
          sessions={sessions}
          preselectedSessionId={noteSessionId}
          onClose={() => setNoteSessionId(null)}
          onSaved={() => {
            setNoteSessionId(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

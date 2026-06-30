'use client'

import { useState, useEffect } from 'react'
import { clockIn, clockOut } from '@/app/actions/clock'
import TimeSheet, { ClockSessionRow } from '@/components/TimeSheet'
import TimeOffModal from '@/components/TimeOffModal'

interface ClockSession {
  id: string
  clockedInAt: string
}

interface Balances {
  vacation_hours: number
  sick_hours: number
  bereavement_hours: number
}

interface Props {
  initialSession: ClockSession | null
  weekStart?: string
  clockSessionRows?: ClockSessionRow[]
  balances?: Balances
}

function formatElapsed(ms: number): string {
  const clamped = Math.max(0, ms)
  const h = Math.floor(clamped / 3600000)
  const m = Math.floor((clamped % 3600000) / 60000)
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date} at ${time}`
}

function AnalogClock({ now }: { now: Date | null }) {
  if (!now) {
    return (
      <svg viewBox="0 0 220 220" className="w-64 h-64 drop-shadow-lg">
        <circle cx="110" cy="110" r="108" fill="#1a1a1a" />
        <circle cx="110" cy="110" r="104" fill="#2d2d2d" />
        <circle cx="110" cy="110" r="100" fill="white" />
      </svg>
    )
  }

  const h = now.getHours() % 12
  const m = now.getMinutes()
  const s = now.getSeconds()

  const secDeg = s * 6 - 90
  const minDeg = m * 6 + s * 0.1 - 90
  const hrDeg = h * 30 + m * 0.5 - 90

  const cx = 110
  const cy = 110
  const r = 100

  function hand(deg: number, length: number, width: number, color: string, tailLen = 10) {
    const rad = (deg * Math.PI) / 180
    const radBack = ((deg + 180) * Math.PI) / 180
    return (
      <line
        x1={cx + tailLen * Math.cos(radBack)}
        y1={cy + tailLen * Math.sin(radBack)}
        x2={cx + length * Math.cos(rad)}
        y2={cy + length * Math.sin(rad)}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
    )
  }

  const numbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

  return (
    <svg viewBox="0 0 220 220" className="w-64 h-64 drop-shadow-lg">
      <circle cx={cx} cy={cy} r={r + 8} fill="#1a1a1a" />
      <circle cx={cx} cy={cy} r={r + 4} fill="#2d2d2d" />
      <circle cx={cx} cy={cy} r={r} fill="white" />

      {Array.from({ length: 60 }, (_, i) => {
        const isHour = i % 5 === 0
        const rad = ((i * 6 - 90) * Math.PI) / 180
        const inner = isHour ? r - 14 : r - 8
        return (
          <line
            key={i}
            x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
            x2={cx + (r - 2) * Math.cos(rad)} y2={cy + (r - 2) * Math.sin(rad)}
            stroke={isHour ? '#1a1a1a' : '#aaa'}
            strokeWidth={isHour ? 2.5 : 1}
          />
        )
      })}

      {numbers.map((n, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180
        return (
          <text
            key={n}
            x={cx + (r - 26) * Math.cos(rad)}
            y={cy + (r - 26) * Math.sin(rad)}
            textAnchor="middle" dominantBaseline="central"
            fontSize="16" fontWeight="700" fontFamily="Arial, sans-serif" fill="#1a1a1a"
          >
            {n}
          </text>
        )
      })}

      {hand(hrDeg, 58, 7, '#1a1a1a', 12)}
      {hand(minDeg, 78, 5, '#1a1a1a', 14)}
      {hand(secDeg, 84, 1.5, '#e53e3e', 16)}

      <circle cx={cx} cy={cy} r={6} fill="#1a1a1a" />
      <circle cx={cx} cy={cy} r={2.5} fill="#e53e3e" />
    </svg>
  )
}

export default function ClockInOut({ initialSession, weekStart, clockSessionRows, balances }: Props) {
  const [session, setSession] = useState<ClockSession | null>(initialSession)
  const [elapsed, setElapsed] = useState('')
  const [localTime, setLocalTime] = useState('')
  const [timezone, setTimezone] = useState('')
  const [now, setNow] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [, setLastHours] = useState<number | null>(null)
  const [clockedOutAt, setClockedOutAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTimeOff, setShowTimeOff] = useState(false)

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)

    function tick() {
      const n = new Date()
      setNow(n)
      setLocalTime(
        n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      )
      if (session) {
        setElapsed(formatElapsed(n.getTime() - new Date(session.clockedInAt).getTime()))
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session])

  async function handleClockIn() {
    setLoading(true)
    setError(null)
    setLastHours(null)
    setClockedOutAt(null)
    const result = await clockIn()
    if (result.session) {
      setSession(result.session)
    } else {
      setError(result.error ?? 'Clock in failed. Please try again.')
    }
    setLoading(false)
  }

  async function handleClockOut() {
    if (!session) return
    setLoading(true)
    setError(null)
    const outTime = new Date().toISOString()
    const result = await clockOut(session.id)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setSession(null)
    setClockedOutAt(outTime)
    if (result.hours !== null) setLastHours(result.hours)
    setLoading(false)
  }

  const isClockedIn = Boolean(session)

  return (
    <div className="flex gap-8 items-start">
      {/* Left: clock + controls */}
      <div className="flex flex-col items-center justify-center py-10 flex-1 min-w-0">
        <AnalogClock now={now} />

        {isClockedIn ? (
          <>
            <div className="mt-5 mb-1 text-center">
              <p className="text-4xl font-mono font-semibold text-slate-800 tabular-nums tracking-wide">
                {localTime || ' '}
              </p>
              {timezone && (
                <p className="text-xs text-slate-400 mt-0.5 tracking-wide">{timezone}</p>
              )}
            </div>

            <div className="mt-4 mb-2 text-center">
              <p className="text-sm text-slate-600">
                Clocked In on{' '}
                <span className="font-semibold text-green-600">
                  {formatDateTime(session!.clockedInAt)}
                </span>
              </p>
            </div>

            <div className="flex flex-col items-center mt-3 mb-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
                Time Logged
              </p>
              <p className="text-3xl font-mono text-slate-500 tabular-nums">
                {elapsed}
              </p>
            </div>

            {error && (
              <p className="mb-3 text-xs text-red-600 font-medium text-center max-w-xs">
                {error}
              </p>
            )}

            <button
              onClick={handleClockOut}
              disabled={loading}
              className="rounded-full bg-red-500 px-14 py-3.5 text-base font-semibold text-white shadow-md hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Clock Out'}
            </button>
          </>
        ) : (
          <>
            {error && (
              <p className="mt-4 text-xs text-red-600 font-medium text-center max-w-xs">
                {error}
              </p>
            )}

            <div className="mt-6 mb-5">
              <button
                onClick={handleClockIn}
                disabled={loading}
                style={{ backgroundColor: '#0B1460' }}
                className="rounded-full px-14 py-3.5 text-base font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Starting...' : 'Clock In'}
              </button>
            </div>

            <div className="mb-1 text-center opacity-40">
              <p className="text-4xl font-mono font-semibold text-slate-800 tabular-nums tracking-wide">
                {localTime || ' '}
              </p>
              {timezone && (
                <p className="text-xs text-slate-400 mt-0.5 tracking-wide">{timezone}</p>
              )}
            </div>

            {clockedOutAt && (
              <div className="mt-3 text-center">
                <p className="text-sm font-semibold text-red-500">
                  Clocked out on {formatDateTime(clockedOutAt)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: time sheet preview */}
      <div className="flex-1 min-w-0 py-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center mb-4">
          Time Sheet Preview
        </h3>
        <div className="rounded-2xl border-4 bg-white overflow-hidden" style={{ borderColor: '#0B1460' }}>
          <div className="overflow-auto max-h-[560px] pt-6 px-2 pb-2">
            {weekStart && clockSessionRows ? (
              <TimeSheet weekStart={weekStart} sessions={clockSessionRows} compact />
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                No data
              </div>
            )}
          </div>
        </div>
        {balances && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Vacation', value: balances.vacation_hours },
              { label: 'Sick', value: balances.sick_hours },
              { label: 'Bereavement', value: balances.bereavement_hours },
            ].map(b => (
              <div key={b.label} className="rounded-lg border border-slate-200 bg-slate-50 py-2 text-center">
                <p className="text-base font-bold text-slate-800">{b.value}</p>
                <p className="text-xs text-slate-500">{b.label} hrs</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => setShowTimeOff(true)}
            className="flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-50"
            style={{ borderColor: '#0B1460', color: '#0B1460' }}
          >
            Request Time Off
          </button>
          <button className="flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-50" style={{ borderColor: '#0B1460', color: '#0B1460' }}>
            Add Note
          </button>
        </div>
      </div>

      {showTimeOff && balances && (
        <TimeOffModal
          balances={balances}
          onClose={() => setShowTimeOff(false)}
        />
      )}
    </div>
  )
}

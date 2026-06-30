'use client'

import { useState, useEffect } from 'react'
import { clockIn, clockOut } from '@/app/actions/clock'
import TimeSheet, { ClockSessionRow } from '@/components/TimeSheet'

interface ClockSession {
  id: string
  clockedInAt: string
}

interface Props {
  initialSession: ClockSession | null
  weekStart?: string
  clockSessionRows?: ClockSessionRow[]
}

function formatElapsed(ms: number): string {
  const clamped = Math.max(0, ms)
  const h = Math.floor(clamped / 3600000)
  const m = Math.floor((clamped % 3600000) / 60000)
  const s = Math.floor((clamped % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date} at ${time}`
}

function AnalogClock({ now }: { now: Date }) {
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
      {/* Outer bezel */}
      <circle cx={cx} cy={cy} r={r + 8} fill="#1a1a1a" />
      {/* Inner bezel highlight */}
      <circle cx={cx} cy={cy} r={r + 4} fill="#2d2d2d" />
      {/* Clock face */}
      <circle cx={cx} cy={cy} r={r} fill="white" />

      {/* Minute tick marks (60) */}
      {Array.from({ length: 60 }, (_, i) => {
        const isHour = i % 5 === 0
        const rad = ((i * 6 - 90) * Math.PI) / 180
        const inner = isHour ? r - 14 : r - 8
        return (
          <line
            key={i}
            x1={cx + inner * Math.cos(rad)}
            y1={cy + inner * Math.sin(rad)}
            x2={cx + (r - 2) * Math.cos(rad)}
            y2={cy + (r - 2) * Math.sin(rad)}
            stroke={isHour ? '#1a1a1a' : '#999'}
            strokeWidth={isHour ? 2.5 : 1}
          />
        )
      })}

      {/* Hour numbers */}
      {numbers.map((n, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180
        const nr = r - 26
        return (
          <text
            key={n}
            x={cx + nr * Math.cos(rad)}
            y={cy + nr * Math.sin(rad)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="16"
            fontWeight="700"
            fontFamily="Arial, sans-serif"
            fill="#1a1a1a"
          >
            {n}
          </text>
        )
      })}

      {/* Hour hand */}
      {hand(hrDeg, 58, 7, '#1a1a1a', 12)}
      {/* Minute hand */}
      {hand(minDeg, 78, 5, '#1a1a1a', 14)}
      {/* Second hand */}
      {hand(secDeg, 84, 1.5, '#e53e3e', 16)}

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={6} fill="#1a1a1a" />
      <circle cx={cx} cy={cy} r={2.5} fill="#e53e3e" />
    </svg>
  )
}

export default function ClockInOut({ initialSession, weekStart, clockSessionRows }: Props) {
  const [session, setSession] = useState<ClockSession | null>(initialSession)
  const [elapsed, setElapsed] = useState('00:00:00')
  const [localTime, setLocalTime] = useState('')
  const [now, setNow] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [, setLastHours] = useState<number | null>(null)
  const [clockedOutAt, setClockedOutAt] = useState<string | null>(null)

  useEffect(() => {
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
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session])

  async function handleClockIn() {
    setLoading(true)
    setLastHours(null)
    setClockedOutAt(null)
    const result = await clockIn()
    if (result.session) setSession(result.session)
    setLoading(false)
  }

  async function handleClockOut() {
    if (!session) return
    setLoading(true)
    const outTime = new Date().toISOString()
    const result = await clockOut(session.id)
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

        {/* Digital time */}
        <p className="font-orbitron text-4xl font-semibold text-slate-800 tabular-nums mt-5 mb-5 tracking-widest">
          {localTime}
        </p>

        {/* Clock in/out status */}
        {isClockedIn ? (
          <p className="text-sm text-slate-600 mb-2">
            Clocked In on{' '}
            <span className="font-semibold text-green-600">
              {formatDateTime(session!.clockedInAt)}
            </span>
          </p>
        ) : clockedOutAt ? (
          <p className="text-sm font-semibold text-red-500 mb-2">
            Clocked out on {formatDateTime(clockedOutAt)}
          </p>
        ) : (
          <div className="mb-2 h-5" />
        )}

        {/* Elapsed timer — greyed out when not clocked in */}
        <div className={`flex flex-col items-center mt-3 mb-7 transition-opacity ${isClockedIn ? 'opacity-100' : 'opacity-30'}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
            Time Logged
          </p>
          <p className="font-orbitron text-3xl tabular-nums tracking-wider text-slate-500">
            {elapsed}
          </p>
        </div>

        {/* Action button */}
        {isClockedIn ? (
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="rounded-full bg-red-500 px-14 py-3.5 text-base font-semibold text-white shadow-md hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Clock Out'}
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={loading}
            style={{ backgroundColor: '#0B1460' }}
            className="rounded-full px-14 py-3.5 text-base font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Starting…' : 'Clock In'}
          </button>
        )}
      </div>

      {/* Right: time sheet preview */}
      <div className="flex-1 min-w-0 py-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center mb-4">
          Time Sheet Preview
        </h3>
        <div className="rounded-2xl border-2 border-indigo-900/80 bg-white overflow-auto max-h-[560px] p-2">
          {weekStart && clockSessionRows ? (
            <TimeSheet weekStart={weekStart} sessions={clockSessionRows} />
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              No data
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

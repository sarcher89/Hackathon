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

  function hand(deg: number, length: number, width: number, color: string) {
    const rad = (deg * Math.PI) / 180
    return (
      <line
        x1="100" y1="100"
        x2={100 + length * Math.cos(rad)}
        y2={100 + length * Math.sin(rad)}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
    )
  }

  return (
    <svg viewBox="0 0 200 200" className="w-44 h-44">
      <circle cx="100" cy="100" r="96" fill="white" stroke="#1e293b" strokeWidth="4" />
      {Array.from({ length: 12 }, (_, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180
        return (
          <line
            key={i}
            x1={100 + 82 * Math.cos(rad)} y1={100 + 82 * Math.sin(rad)}
            x2={100 + 92 * Math.cos(rad)} y2={100 + 92 * Math.sin(rad)}
            stroke="#1e293b" strokeWidth="2.5"
          />
        )
      })}
      {hand(hrDeg, 52, 5, '#1e293b')}
      {hand(minDeg, 70, 3, '#1e293b')}
      {hand(secDeg, 76, 1.5, '#ef4444')}
      <circle cx="100" cy="100" r="4" fill="#1e293b" />
    </svg>
  )
}

export default function ClockInOut({ initialSession, weekStart, clockSessionRows }: Props) {
  const [session, setSession] = useState<ClockSession | null>(initialSession)
  const [elapsed, setElapsed] = useState('')
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
      } else {
        setElapsed('')
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

  return (
    <div className="flex gap-8 items-start">
      {/* Left: clock + controls */}
      <div className="flex flex-col items-center justify-center py-12 flex-1 min-w-0">
        <AnalogClock now={now} />

        <p className="text-4xl font-mono font-semibold text-slate-800 tabular-nums mt-6 mb-6 tracking-wide">
          {localTime}
        </p>

        {session ? (
          <>
            <p className="text-sm text-slate-600 mb-1">
              Clocked In on{' '}
              <span className="font-semibold text-green-600">
                {formatDateTime(session.clockedInAt)}
              </span>
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-4 mb-1">
              Time Logged
            </p>
            <p className="text-3xl font-mono text-slate-500 tabular-nums mb-8">
              {elapsed}
            </p>
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="rounded-full bg-red-500 px-12 py-3.5 text-base font-semibold text-white shadow-md hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : 'Clock Out'}
            </button>
          </>
        ) : (
          <>
            {clockedOutAt !== null ? (
              <p className="text-sm font-semibold text-red-500 mb-8">
                Clocked out on {formatDateTime(clockedOutAt)}
              </p>
            ) : (
              <div className="mb-8" />
            )}
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="rounded-full bg-blue-600 px-12 py-3.5 text-base font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Starting…' : 'Clock In'}
            </button>
          </>
        )}
      </div>

      {/* Right: time sheet preview */}
      <div className="flex-1 min-w-0 py-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center mb-4">
          Time Sheet Preview
        </h3>
        <div className="rounded-2xl border-2 border-indigo-900/80 bg-white overflow-auto max-h-[520px] p-2">
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

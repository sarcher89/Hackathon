'use client'

import { useState, useEffect } from 'react'
import { clockIn, clockOut } from '@/app/actions/clock'

interface ClockSession {
  id: string
  clockedInAt: string
}

interface Props {
  initialSession: ClockSession | null
}

function formatElapsed(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function ClockInOut({ initialSession }: Props) {
  const [session, setSession] = useState<ClockSession | null>(initialSession)
  const [elapsed, setElapsed] = useState('')
  const [localTime, setLocalTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastHours, setLastHours] = useState<number | null>(null)

  useEffect(() => {
    function tick() {
      const now = new Date()
      setLocalTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }))
      if (session) {
        const ms = now.getTime() - new Date(session.clockedInAt).getTime()
        setElapsed(formatElapsed(ms))
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
    const result = await clockIn()
    if (result.session) setSession(result.session)
    setLoading(false)
  }

  async function handleClockOut() {
    if (!session) return
    setLoading(true)
    const result = await clockOut(session.id)
    setSession(null)
    if (result.hours !== null) setLastHours(result.hours)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center py-24">
      <p className="text-sm text-slate-400 mb-4">{formatToday()}</p>
      <p className="text-5xl font-mono font-semibold text-slate-800 tabular-nums mb-10">
        {localTime}
      </p>

      {session ? (
        <>
          <p className="text-sm text-slate-500 mb-3">
            Clocked in at <span className="font-semibold text-slate-700">{formatTime(session.clockedInAt)}</span>
          </p>
          <p className="text-3xl font-mono text-slate-500 tabular-nums mb-10">
            {elapsed}
          </p>
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="rounded-full bg-red-500 px-12 py-4 text-lg font-semibold text-white shadow-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Clock Out'}
          </button>
        </>
      ) : (
        <>
          {lastHours !== null ? (
            <p className="text-sm text-green-600 mb-8">
              Session saved — <span className="font-semibold">{lastHours} hrs</span> recorded
            </p>
          ) : (
            <div className="mb-8" />
          )}
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="rounded-full bg-blue-600 px-12 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Starting…' : 'Clock In'}
          </button>
        </>
      )}
    </div>
  )
}

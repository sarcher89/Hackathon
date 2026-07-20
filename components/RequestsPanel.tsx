'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getAllTimeOffRequests,
  updateTimeOffRequestStatus,
  type TimeOffRequestWithUser,
} from '@/app/actions/timeoff'
import { toISODate } from '@/lib/dates'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TYPE_LABEL: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  bereavement: 'Bereavement',
}

const TYPE_DOT: Record<string, string> = {
  vacation: 'bg-blue-500',
  sick: 'bg-amber-500',
  bereavement: 'bg-slate-500',
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // days since Monday
  const gridStart = new Date(year, month, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

function RequestCard({
  request,
  actionable,
  onApprove,
  onDeny,
  onSelect,
  busy,
}: {
  request: TimeOffRequestWithUser
  actionable: boolean
  onApprove?: () => void
  onDeny?: () => void
  onSelect?: () => void
  busy: boolean
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded border border-slate-200 bg-white p-3 ${onSelect ? 'cursor-pointer hover:border-blue-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">{request.userName}</p>
          <p className="text-xs text-slate-400">{request.userEmail}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white ${TYPE_DOT[request.type] ?? 'bg-slate-400'}`}>
          {TYPE_LABEL[request.type] ?? request.type}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {formatDate(request.date)} &middot; {request.hours}h
      </p>
      {request.notes && <p className="mt-1 text-xs italic text-slate-400">&ldquo;{request.notes}&rdquo;</p>}
      {actionable && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={e => {
              e.stopPropagation()
              onApprove?.()
            }}
            disabled={busy}
            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              onDeny?.()
            }}
            disabled={busy}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  requests,
  actionable,
  onApprove,
  onDeny,
  onSelectRequest,
  busyId,
}: {
  title: string
  requests: TimeOffRequestWithUser[]
  actionable?: boolean
  onApprove?: (id: string) => void
  onDeny?: (id: string) => void
  onSelectRequest?: (request: TimeOffRequestWithUser) => void
  busyId: string | null
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        {title} <span className="text-slate-400 font-normal">({requests.length})</span>
      </h3>
      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <RequestCard
              key={r.id}
              request={r}
              actionable={Boolean(actionable)}
              onApprove={() => onApprove?.(r.id)}
              onDeny={() => onDeny?.(r.id)}
              onSelect={onSelectRequest ? () => onSelectRequest(r) : undefined}
              busy={busyId === r.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RequestsPanel() {
  const [requests, setRequests] = useState<TimeOffRequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())

  useEffect(() => {
    getAllTimeOffRequests().then(data => {
      setRequests(data)
      setLoading(false)
    })
  }, [])

  async function handleStatusChange(id: string, status: 'approved' | 'denied') {
    setBusyId(id)
    const result = await updateTimeOffRequestStatus(id, status)
    if (result.success) {
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
    }
    setBusyId(null)
  }

  const pending = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const denied = requests.filter(r => r.status === 'denied')

  const requestsByDate = useMemo(() => {
    const map = new Map<string, TimeOffRequestWithUser[]>()
    for (const r of requests) {
      if (r.status === 'denied') continue
      if (!map.has(r.date)) map.set(r.date, [])
      map.get(r.date)!.push(r)
    }
    return map
  }, [requests])

  const monthGrid = useMemo(() => getMonthGrid(selectedYear, selectedMonth), [selectedYear, selectedMonth])
  const weeks = useMemo(() => {
    const rows: Date[][] = []
    for (let i = 0; i < monthGrid.length; i += 7) rows.push(monthGrid.slice(i, i + 7))
    return rows
  }, [monthGrid])

  const yearOptions = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i)

  function jumpToRequest(request: TimeOffRequestWithUser) {
    const d = new Date(request.date + 'T00:00:00')
    setSelectedMonth(d.getMonth())
    setSelectedYear(d.getFullYear())
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading requests…</p>
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left: status sections */}
      <div className="space-y-8">
        <Section
          title="Pending Approval"
          requests={pending}
          actionable
          onApprove={id => handleStatusChange(id, 'approved')}
          onDeny={id => handleStatusChange(id, 'denied')}
          onSelectRequest={jumpToRequest}
          busyId={busyId}
        />
        <Section title="Approved" requests={approved} busyId={busyId} />
        <Section title="Denied" requests={denied} busyId={busyId} />
      </div>

      {/* Right: calendar */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {DAY_ABBR.map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
              {week.map(day => {
                const iso = toISODate(day)
                const isCurrentMonth = day.getMonth() === selectedMonth
                const dayRequests = requestsByDate.get(iso) ?? []
                return (
                  <div
                    key={iso}
                    className={`min-h-[84px] border-r border-slate-100 last:border-r-0 p-1.5 ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <p className={`text-xs ${isCurrentMonth ? 'text-slate-600' : 'text-slate-300'}`}>{day.getDate()}</p>
                    <div className="mt-1 space-y-0.5">
                      {dayRequests.map(r => (
                        <div
                          key={r.id}
                          title={`${r.userName} — ${TYPE_LABEL[r.type] ?? r.type} (${r.status})`}
                          className={[
                            'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight truncate',
                            r.status === 'pending'
                              ? 'border border-dashed border-slate-300 text-slate-500'
                              : 'bg-green-100 text-green-800',
                          ].join(' ')}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[r.type] ?? 'bg-slate-400'}`} />
                          <span className="truncate">{r.userName.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <p className="mt-2 text-xs text-slate-400">Dotted grey chips are pending; green chips are approved.</p>
      </div>
    </div>
  )
}

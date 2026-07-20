'use client'

import { useEffect, useState } from 'react'
import { getMyTimeOffRequests, type MyTimeOffRequest } from '@/app/actions/timeoff'

const TYPE_LABEL: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  bereavement: 'Bereavement',
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function RequestRow({ request }: { request: MyTimeOffRequest }) {
  return (
    <div className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5">
      <span className="text-xs text-slate-700">
        {formatDate(request.date)} &middot; {TYPE_LABEL[request.type] ?? request.type}
      </span>
      <span className="text-xs font-medium text-slate-500">{request.hours}h</span>
    </div>
  )
}

export default function MyTimeOffSummary() {
  const [requests, setRequests] = useState<MyTimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyTimeOffRequests().then(data => {
      setRequests(data)
      setLoading(false)
    })
  }, [])

  if (loading) return null

  const approved = requests.filter(r => r.status === 'approved')
  const pending = requests.filter(r => r.status === 'pending')

  if (approved.length === 0 && pending.length === 0) return null

  return (
    <div className="mt-4 space-y-3">
      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Approved Time Off
        </h4>
        {approved.length === 0 ? (
          <p className="text-xs text-slate-400">None yet.</p>
        ) : (
          <div className="space-y-1">
            {approved.map(r => (
              <RequestRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pending Time Off
        </h4>
        {pending.length === 0 ? (
          <p className="text-xs text-slate-400">None yet.</p>
        ) : (
          <div className="space-y-1">
            {pending.map(r => (
              <RequestRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

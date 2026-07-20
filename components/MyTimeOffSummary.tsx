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

function RequestRow({ request, dotClass }: { request: MyTimeOffRequest; dotClass: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs">
      <span className="flex items-center gap-1.5 text-slate-600">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
        {formatDate(request.date)} &middot; {TYPE_LABEL[request.type] ?? request.type}
      </span>
      <span className="font-medium text-slate-500">{request.hours}h</span>
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
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
      {approved.length > 0 && (
        <div className="py-1.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Approved ({approved.length})
          </p>
          {approved.map(r => (
            <RequestRow key={r.id} request={r} dotClass="bg-green-500" />
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div className="py-1.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Pending ({pending.length})
          </p>
          {pending.map(r => (
            <RequestRow key={r.id} request={r} dotClass="bg-amber-400" />
          ))}
        </div>
      )}
    </div>
  )
}

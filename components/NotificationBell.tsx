'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMyNotifications, markNotificationRead } from '@/app/actions/notifications'
import { Notification } from '@/types/database'

const NOTIFICATION_LINK: Record<string, string> = {
  time_off_request: '/leader?tab=requests',
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMyNotifications().then(setNotifications)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  async function handleNotificationClick(n: Notification) {
    if (!n.read) {
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)))
      await markNotificationRead(n.id)
    }

    const link = NOTIFICATION_LINK[n.type]
    if (link) {
      setOpen(false)
      router.push(link)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="rounded-full p-1.5 hover:bg-slate-200 transition-colors relative"
        aria-label="Notifications"
        style={{ color: '#0B1460' }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              notifications.map(n => {
                const clickable = Boolean(NOTIFICATION_LINK[n.type]) || !n.read
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    disabled={!clickable}
                    className={[
                      'block w-full border-b border-slate-50 px-4 py-3 text-left last:border-b-0 transition-colors',
                      n.read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/60 hover:bg-blue-50',
                    ].join(' ')}
                  >
                    <p className={`text-sm ${n.read ? 'text-slate-400' : 'text-slate-700'}`}>{n.message}</p>
                    <p className={`mt-0.5 text-xs ${n.read ? 'text-slate-300' : 'text-slate-400'}`}>
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

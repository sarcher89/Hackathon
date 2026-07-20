'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ClockInOut from '@/components/ClockInOut'
import TimeSheet, { ClockSessionRow } from '@/components/TimeSheet'
import TimeGrid from '@/components/TimeGrid'
import PayStub from '@/components/PayStub'
import LeaderGrid, { ExportEntry, ExportClockSession } from '@/components/LeaderGrid'
import AdminPanel from '@/components/AdminPanel'
import RequestsPanel from '@/components/RequestsPanel'
import { Client, Project, Task, User } from '@/types/database'

type Tab = 'clock' | 'timesheet' | 'projectlog' | 'paystub' | 'payroll' | 'team' | 'requests'

const USER_TABS: { key: Tab; label: string }[] = [
  { key: 'clock', label: 'Clock In / Out' },
  { key: 'timesheet', label: 'Time Sheet' },
  { key: 'projectlog', label: 'Project Log' },
  { key: 'paystub', label: 'Pay Stub' },
]

const ADMIN_TABS: { key: Tab; label: string }[] = [
  { key: 'payroll', label: 'Payroll Export' },
  { key: 'team', label: 'Admin' },
  { key: 'requests', label: 'Requests' },
]

const ALL_TAB_KEYS = new Set<Tab>([...USER_TABS, ...ADMIN_TABS].map(t => t.key))

interface ClockSession {
  id: string
  clockedInAt: string
}

interface GridRow {
  rowId: string
  clientId: string
  projectId: string | null
  taskId: string
  hours: Record<string, string>
  notes: Record<string, string>
}

interface Props {
  weekStart: string
  entries: ExportEntry[]
  payrollClockSessions: ExportClockSession[]
  users: User[]
  clockSession: ClockSession | null
  clients: Client[]
  projectsByClient: Record<string, Project[]>
  tasks: Task[]
  initialRows: GridRow[]
  clockSessionRows: ClockSessionRow[]
  userName: string
  userEmail: string
  hourlyWage: number
  balances: { vacation_hours: number; sick_hours: number; bereavement_hours: number }
}

export default function LeaderTabs({
  weekStart,
  entries,
  payrollClockSessions,
  users,
  clockSession,
  clients,
  projectsByClient,
  tasks,
  initialRows,
  clockSessionRows,
  userName,
  userEmail,
  hourlyWage,
  balances,
}: Props) {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('clock')

  // Re-derive the tab whenever the ?tab= param changes, not just on mount —
  // a notification link pushes a new ?tab= while already on this page, which
  // doesn't remount this component, so a useState initializer alone misses it.
  useEffect(() => {
    const requestedTab = searchParams.get('tab') as Tab | null
    if (requestedTab && ALL_TAB_KEYS.has(requestedTab)) {
      setTab(requestedTab)
    }
  }, [searchParams])

  return (
    <div>
      <div className="border-b border-slate-200 mb-6 pb-2">
        <nav className="flex items-center justify-between gap-1">
          <div className="flex gap-1">
            {USER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={tab === t.key ? { backgroundColor: '#0B1460' } : {}}
                className={[
                  'px-5 py-2 text-sm font-semibold rounded-md transition-colors',
                  tab === t.key
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {ADMIN_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={tab === t.key ? { backgroundColor: '#dc2626' } : {}}
                className={[
                  'px-5 py-2 text-sm font-semibold rounded-md transition-colors',
                  tab === t.key
                    ? 'text-white'
                    : 'text-red-500 hover:text-red-700 hover:bg-red-50',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {tab === 'clock' && (
        <ClockInOut
          initialSession={clockSession}
          weekStart={weekStart}
          clockSessionRows={clockSessionRows}
          balances={balances}
          clients={clients}
          projectsByClient={projectsByClient}
          tasks={tasks}
        />
      )}
      {tab === 'timesheet' && (
        <TimeSheet
          weekStart={weekStart}
          sessions={clockSessionRows}
        />
      )}
      {tab === 'projectlog' && (
        <TimeGrid
          weekStart={weekStart}
          clients={clients}
          projectsByClient={projectsByClient}
          tasks={tasks}
          initialRows={initialRows}
          clockSessionRows={clockSessionRows}
        />
      )}
      {tab === 'paystub' && (
        <PayStub
          weekStart={weekStart}
          userName={userName}
          userEmail={userEmail}
          hourlyWage={hourlyWage}
          sessions={clockSessionRows}
        />
      )}
      {tab === 'payroll' && (
        <LeaderGrid
          weekStart={weekStart}
          entries={entries}
          clockSessions={payrollClockSessions}
        />
      )}
      {tab === 'team' && (
        <AdminPanel users={users} clients={clients} projectsByClient={projectsByClient} tasks={tasks} />
      )}
      {tab === 'requests' && (
        <RequestsPanel />
      )}
    </div>
  )
}

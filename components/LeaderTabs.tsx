'use client'

import { useState } from 'react'
import ClockInOut from '@/components/ClockInOut'
import TimeSheet, { ClockSessionRow } from '@/components/TimeSheet'
import TimeGrid from '@/components/TimeGrid'
import PayStub from '@/components/PayStub'
import LeaderGrid, { ExportEntry } from '@/components/LeaderGrid'
import WageManager from '@/components/WageManager'
import { Client, Project, Task, User } from '@/types/database'

type Tab = 'clock' | 'timesheet' | 'projectlog' | 'paystub' | 'payroll' | 'team'

const USER_TABS: { key: Tab; label: string }[] = [
  { key: 'clock', label: 'Clock In / Out' },
  { key: 'timesheet', label: 'Time Sheet' },
  { key: 'projectlog', label: 'Project Log' },
  { key: 'paystub', label: 'Pay Stub' },
]

const ADMIN_TABS: { key: Tab; label: string }[] = [
  { key: 'payroll', label: 'Payroll Export' },
  { key: 'team', label: 'Employee Information' },
]

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
}

interface Props {
  weekStart: string
  dates: string[]
  entries: ExportEntry[]
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
}

export default function LeaderTabs({
  weekStart,
  dates,
  entries,
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
}: Props) {
  const [tab, setTab] = useState<Tab>('clock')

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
        />
      )}
      {tab === 'timesheet' && (
        <TimeSheet
          key={weekStart}
          weekStart={weekStart}
          sessions={clockSessionRows}
        />
      )}
      {tab === 'projectlog' && (
        <TimeGrid
          key={weekStart}
          weekStart={weekStart}
          dates={dates}
          clients={clients}
          projectsByClient={projectsByClient}
          tasks={tasks}
          initialRows={initialRows}
        />
      )}
      {tab === 'paystub' && (
        <PayStub
          key={weekStart}
          weekStart={weekStart}
          userName={userName}
          userEmail={userEmail}
          hourlyWage={hourlyWage}
          sessions={clockSessionRows}
        />
      )}
      {tab === 'payroll' && (
        <LeaderGrid
          key={weekStart}
          weekStart={weekStart}
          dates={dates}
          entries={entries}
        />
      )}
      {tab === 'team' && (
        <WageManager users={users} />
      )}
    </div>
  )
}

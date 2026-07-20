'use client'

import { useState } from 'react'
import ClockInOut from '@/components/ClockInOut'
import TimeSheet, { ClockSessionRow } from '@/components/TimeSheet'
import TimeGrid from '@/components/TimeGrid'
import PayStub from '@/components/PayStub'
import { Client, Project, Task } from '@/types/database'

interface Balances {
  vacation_hours: number
  sick_hours: number
  bereavement_hours: number
}

type Tab = 'clock' | 'timesheet' | 'projectlog' | 'paystub'

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
  clockSession: ClockSession | null
  weekStart: string
  clients: Client[]
  projectsByClient: Record<string, Project[]>
  tasks: Task[]
  initialRows: GridRow[]
  clockSessionRows: ClockSessionRow[]
  userName: string
  userEmail: string
  hourlyWage: number
  balances: Balances
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'clock', label: 'Clock In / Out' },
  { key: 'timesheet', label: 'Time Sheet' },
  { key: 'projectlog', label: 'Project Log' },
  { key: 'paystub', label: 'Pay Stub' },
]

export default function DashboardTabs({
  clockSession,
  weekStart,
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
  const [tab, setTab] = useState<Tab>('clock')

  return (
    <div>
      <div className="border-b border-slate-200 mb-6 pb-2">
        <nav className="flex gap-1">
          {TABS.map(t => (
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
    </div>
  )
}

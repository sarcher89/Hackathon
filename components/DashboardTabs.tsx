'use client'

import { useState } from 'react'
import ClockInOut from '@/components/ClockInOut'
import TimeSheet, { ClockSessionRow } from '@/components/TimeSheet'
import TimeGrid from '@/components/TimeGrid'
import { Client, Project, Task } from '@/types/database'

type Tab = 'clock' | 'timesheet' | 'projectlog'

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
  clockSession: ClockSession | null
  weekStart: string
  dates: string[]
  clients: Client[]
  projectsByClient: Record<string, Project[]>
  tasks: Task[]
  initialRows: GridRow[]
  clockSessionRows: ClockSessionRow[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'clock', label: 'Clock In / Out' },
  { key: 'timesheet', label: 'Time Sheet' },
  { key: 'projectlog', label: 'Project Log' },
]

export default function DashboardTabs({
  clockSession,
  weekStart,
  dates,
  clients,
  projectsByClient,
  tasks,
  initialRows,
  clockSessionRows,
}: Props) {
  const [tab, setTab] = useState<Tab>('clock')

  return (
    <div>
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'clock' && (
        <ClockInOut initialSession={clockSession} />
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
    </div>
  )
}

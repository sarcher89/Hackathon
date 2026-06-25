'use client'

import { useState } from 'react'
import ClockInOut from '@/components/ClockInOut'
import TimeGrid from '@/components/TimeGrid'
import { Client, Project, Task } from '@/types/database'

type Tab = 'clock' | 'timesheet'

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
}

export default function DashboardTabs({
  clockSession,
  weekStart,
  dates,
  clients,
  projectsByClient,
  tasks,
  initialRows,
}: Props) {
  const [tab, setTab] = useState<Tab>('clock')

  return (
    <div>
      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex">
          <button
            onClick={() => setTab('clock')}
            className={[
              'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === 'clock'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            Clock In / Out
          </button>
          <button
            onClick={() => setTab('timesheet')}
            className={[
              'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === 'timesheet'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            Time Sheet
          </button>
        </nav>
      </div>

      {tab === 'clock' ? (
        <ClockInOut initialSession={clockSession} />
      ) : (
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

'use client'

import { useState } from 'react'
import LeaderGrid, { ExportEntry } from '@/components/LeaderGrid'
import WageManager from '@/components/WageManager'
import { User } from '@/types/database'

type Tab = 'payroll' | 'team'

interface Props {
  weekStart: string
  dates: string[]
  entries: ExportEntry[]
  users: User[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'payroll', label: 'Payroll Export' },
  { key: 'team', label: 'Team Wages' },
]

export default function LeaderTabs({ weekStart, dates, entries, users }: Props) {
  const [tab, setTab] = useState<Tab>('payroll')

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

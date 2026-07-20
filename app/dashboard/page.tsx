import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { getPeriodStart, getPeriodDates, toISODate } from '@/lib/dates'
import { Client, Project, Task, TimeEntry } from '@/types/database'
import DashboardTabs from '@/components/DashboardTabs'
import { autoCloseStaleSession } from '@/app/actions/clock'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { week?: string }
}) {
  const supabase = createSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const user = await getOrCreateUser(supabase)
  if (!user) redirect('/login')
  if (user.role === 'leader' || user.role === 'admin') redirect('/leader')

  await autoCloseStaleSession(supabase, user.id)

  // Resolve period (1st–15th or 16th–end of month)
  const weekParam = searchParams.week
  const periodStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
    ? getPeriodStart(new Date(weekParam + 'T00:00:00'))
    : getPeriodStart(new Date())

  const periodDates = getPeriodDates(periodStart).map(toISODate)
  const weekStart = toISODate(periodStart)

  // Fetch all data in parallel
  const [clientsRes, projectsRes, tasksRes, entriesRes, clockRes, sessionsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('active', true).order('name'),
    supabase.from('projects').select('*').eq('active', true).order('name'),
    supabase.from('tasks').select('*').order('sort_order'),
    supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('entry_date', periodDates[0])
      .lte('entry_date', periodDates[periodDates.length - 1]),
    supabase
      .from('clock_sessions')
      .select('id, clocked_in_at')
      .eq('user_id', user.id)
      .is('clocked_out_at', null)
      .order('clocked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('clock_sessions')
      .select('id, entry_date, clocked_in_at, clocked_out_at, hours, notes')
      .eq('user_id', user.id)
      .gte('entry_date', periodDates[0])
      .lte('entry_date', periodDates[periodDates.length - 1])
      .order('clocked_in_at'),
  ])

  const clients: Client[] = clientsRes.data ?? []
  const projects: Project[] = projectsRes.data ?? []
  const tasks: Task[] = tasksRes.data ?? []
  const entries: TimeEntry[] = entriesRes.data ?? []
  const openSession = clockRes.data
  const clockSessionRows = (sessionsRes.data ?? []).map(s => ({
    id: s.id,
    date: s.entry_date,
    clockedInAt: s.clocked_in_at,
    clockedOutAt: s.clocked_out_at,
    hours: s.hours,
    notes: s.notes,
  }))

  // Index projects by client
  const projectsByClient: Record<string, Project[]> = {}
  for (const p of projects) {
    if (!projectsByClient[p.client_id]) projectsByClient[p.client_id] = []
    projectsByClient[p.client_id].push(p)
  }

  // Group entries into grid rows
  const rowMap = new Map<
    string,
    { clientId: string; projectId: string | null; taskId: string; hours: Record<string, string>; notes: Record<string, string> }
  >()
  for (const entry of entries) {
    const key = `${entry.client_id}|${entry.project_id ?? ''}|${entry.task_id}`
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        clientId: entry.client_id,
        projectId: entry.project_id,
        taskId: entry.task_id,
        hours: {},
        notes: {},
      })
    }
    rowMap.get(key)!.hours[entry.entry_date] = String(entry.hours)
    if (entry.notes) rowMap.get(key)!.notes[entry.entry_date] = entry.notes
  }

  const initialRows = Array.from(rowMap.entries()).map(([key, row]) => ({
    rowId: key,
    ...row,
  }))

  const clockSession = openSession
    ? { id: openSession.id, clockedInAt: openSession.clocked_in_at }
    : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800">
          Hello, {(user.full_name || user.email).split(' ')[0]}
        </h2>
      </div>

      <DashboardTabs
        clockSession={clockSession}
        weekStart={weekStart}
        periodDates={periodDates}
        clients={clients}
        projectsByClient={projectsByClient}
        tasks={tasks}
        initialRows={initialRows}
        clockSessionRows={clockSessionRows}
        userName={user.full_name || user.email}
        userEmail={user.email}
        hourlyWage={user.hourly_wage ?? 0}
        balances={{
          vacation_hours: user.vacation_hours ?? 80,
          sick_hours: user.sick_hours ?? 40,
          bereavement_hours: user.bereavement_hours ?? 16,
        }}
      />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { getMondayOfWeek, getWeekDates, getPeriodStart, getPeriodDates, toISODate } from '@/lib/dates'
import { ExportEntry } from '@/components/LeaderGrid'
import LeaderTabs from '@/components/LeaderTabs'
import { Client, Project, Task, TimeEntry, User } from '@/types/database'

export default async function LeaderPage({
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
  if (!user || (user.role !== 'leader' && user.role !== 'admin')) redirect('/dashboard')

  // Resolve period (1st–15th or 16th–end of month)
  const weekParam = searchParams.week
  const periodStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
    ? getPeriodStart(new Date(weekParam + 'T00:00:00'))
    : getPeriodStart(new Date())

  const periodDates = getPeriodDates(periodStart).map(toISODate)
  const weekStart = toISODate(periodStart)

  // Keep 7-day dates for TimeGrid columns (Mon–Sun of the week containing period start)
  const monday = getMondayOfWeek(periodStart)
  const dates = getWeekDates(monday).map(toISODate)

  // Fetch all data in parallel
  const [usersRes, rowsRes, clientsRes, projectsRes, tasksRes, myEntriesRes, clockRes, sessionsRes] = await Promise.all([
    supabase.from('users').select('*').order('full_name'),
    supabase
      .from('time_entries')
      .select(`
        id,
        entry_date,
        hours,
        notes,
        exported,
        user:users!inner(full_name, email),
        client:clients!inner(name),
        project:projects(name),
        task:tasks!inner(name, category)
      `)
      .gte('entry_date', dates[0])
      .lte('entry_date', dates[6])
      .order('entry_date')
      .order('users.full_name'),
    supabase.from('clients').select('*').eq('active', true).order('name'),
    supabase.from('projects').select('*').eq('active', true).order('name'),
    supabase.from('tasks').select('*').order('sort_order'),
    supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('entry_date', dates[0])
      .lte('entry_date', dates[6]),
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
      .select('id, entry_date, clocked_in_at, clocked_out_at, hours')
      .eq('user_id', user.id)
      .gte('entry_date', periodDates[0])
      .lte('entry_date', periodDates[periodDates.length - 1])
      .order('clocked_in_at'),
  ])

  const users: User[] = (usersRes.data ?? []) as User[]
  const clients: Client[] = clientsRes.data ?? []
  const projects: Project[] = projectsRes.data ?? []
  const tasks: Task[] = tasksRes.data ?? []
  const myEntries: TimeEntry[] = myEntriesRes.data ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: ExportEntry[] = (rowsRes.data ?? []).map((r: any) => ({
    id: r.id,
    userName: r.user?.full_name ?? r.user?.email ?? 'Unknown',
    userEmail: r.user?.email ?? '',
    date: r.entry_date,
    clientName: r.client?.name ?? '',
    projectName: r.project?.name ?? null,
    taskName: r.task?.name ?? '',
    taskCategory: r.task?.category ?? '',
    hours: r.hours,
    notes: r.notes,
    exported: r.exported,
  }))

  // Index projects by client
  const projectsByClient: Record<string, Project[]> = {}
  for (const p of projects) {
    if (!projectsByClient[p.client_id]) projectsByClient[p.client_id] = []
    projectsByClient[p.client_id].push(p)
  }

  // Group own entries into grid rows
  const rowMap = new Map<
    string,
    { clientId: string; projectId: string | null; taskId: string; hours: Record<string, string> }
  >()
  for (const entry of myEntries) {
    const key = `${entry.client_id}|${entry.project_id ?? ''}|${entry.task_id}`
    if (!rowMap.has(key)) {
      rowMap.set(key, { clientId: entry.client_id, projectId: entry.project_id, taskId: entry.task_id, hours: {} })
    }
    rowMap.get(key)!.hours[entry.entry_date] = String(entry.hours)
  }
  const initialRows = Array.from(rowMap.entries()).map(([key, row]) => ({ rowId: key, ...row }))

  const clockSession = clockRes.data
    ? { id: clockRes.data.id, clockedInAt: clockRes.data.clocked_in_at }
    : null

  const clockSessionRows = (sessionsRes.data ?? []).map(s => ({
    id: s.id,
    date: s.entry_date,
    clockedInAt: s.clocked_in_at,
    clockedOutAt: s.clocked_out_at,
    hours: s.hours,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800">
          Hello, {(user.full_name || user.email).split(' ')[0]}
        </h2>
      </div>

      <LeaderTabs
        weekStart={weekStart}
        dates={dates}
        entries={entries}
        users={users}
        clockSession={clockSession}
        clients={clients}
        projectsByClient={projectsByClient}
        tasks={tasks}
        initialRows={initialRows}
        clockSessionRows={clockSessionRows}
        userName={user.full_name || user.email}
        userEmail={user.email}
        hourlyWage={user.hourly_wage ?? 0}
        balances={{
          vacation_hours: (user as any).vacation_hours ?? 80,
          sick_hours: (user as any).sick_hours ?? 40,
          bereavement_hours: (user as any).bereavement_hours ?? 16,
        }}
    </div>
  )
}

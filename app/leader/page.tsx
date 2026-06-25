import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { getMondayOfWeek, getWeekDates, toISODate } from '@/lib/dates'
import { ExportEntry } from '@/components/LeaderGrid'
import LeaderTabs from '@/components/LeaderTabs'
import { User } from '@/types/database'

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

  // Resolve week
  const weekParam = searchParams.week
  const monday =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? getMondayOfWeek(new Date(weekParam + 'T00:00:00'))
      : getMondayOfWeek(new Date())

  const dates = getWeekDates(monday).map(toISODate)
  const weekStart = toISODate(monday)

  // Fetch users and entries in parallel
  const [usersRes, rowsRes] = await Promise.all([
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
  ])

  const users: User[] = (usersRes.data ?? []) as User[]

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Leader Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">Weekly team summary and payroll export</p>
      </div>

      <LeaderTabs
        weekStart={weekStart}
        dates={dates}
        entries={entries}
        users={users}
      />
    </div>
  )
}

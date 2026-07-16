import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Client, Project, Task, User } from '@/types/database'

// Temporary admin endpoint used to seed dummy time entries for a regular
// (ic) user in a hosted environment where no local shell is available.
// Guarded by SEED_SECRET so it can't be triggered by an arbitrary visitor.
// Delete this route once the seeding is done.

export const dynamic = 'force-dynamic'

const SEED_MARKER = 'dummy-seed'
const MONTHS_BACK = 2

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function weekdaysBack(months: number): string[] {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setMonth(start.getMonth() - months)

  const dates: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) dates.push(toISODate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function tasksForClient(tasks: Task[], client: Client): Task[] {
  return tasks.filter(t => {
    if (t.system === 'both') return true
    if (client.system === 'denticon') return t.system === 'denticon'
    if (client.system === 'cloud9') return t.system === 'cloud9'
    return true
  })
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function runSeed(email: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  let userQuery = supabase.from('users').select('*').eq('role', 'ic')
  if (email) userQuery = userQuery.eq('email', email)
  const { data: icUsers, error: userErr } = await userQuery
  if (userErr) throw userErr

  if (!icUsers || icUsers.length === 0) {
    throw new Error(
      email ? `No 'ic' user found with email ${email}.` : `No 'ic' (regular) users found.`
    )
  }
  if (icUsers.length > 1 && !email) {
    throw new Error(
      `Multiple ic users found: ${icUsers.map(u => u.email).join(', ')}. Re-call with ?email=`
    )
  }

  const user = icUsers[0] as User

  const [clientsRes, projectsRes, tasksRes] = await Promise.all([
    supabase.from('clients').select('*').eq('active', true),
    supabase.from('projects').select('*').eq('active', true),
    supabase.from('tasks').select('*'),
  ])
  if (clientsRes.error) throw clientsRes.error
  if (projectsRes.error) throw projectsRes.error
  if (tasksRes.error) throw tasksRes.error

  const clients = (clientsRes.data ?? []) as Client[]
  const projects = (projectsRes.data ?? []) as Project[]
  const tasks = (tasksRes.data ?? []) as Task[]

  if (!clients.length || !tasks.length) {
    throw new Error('No active clients or tasks found — cannot generate entries.')
  }

  const projectsByClient = new Map<string, Project[]>()
  for (const p of projects) {
    if (!projectsByClient.has(p.client_id)) projectsByClient.set(p.client_id, [])
    projectsByClient.get(p.client_id)!.push(p)
  }

  const dates = weekdaysBack(MONTHS_BACK)

  const { error: delErr } = await supabase
    .from('time_entries')
    .delete()
    .eq('user_id', user.id)
    .eq('notes', SEED_MARKER)
    .gte('entry_date', dates[0])
    .lte('entry_date', dates[dates.length - 1])
  if (delErr) throw delErr

  const rows = []
  for (const date of dates) {
    const numRows = Math.random() < 0.7 ? 1 : 2
    let remaining = Math.round((Math.random() * 2 + 6.5) * 2) / 2 // 6.5–8.5 in 0.5 steps

    for (let i = 0; i < numRows; i++) {
      const client = pick(clients)
      const clientTasks = tasksForClient(tasks, client)
      const task = pick(clientTasks.length ? clientTasks : tasks)
      const clientProjects = projectsByClient.get(client.id) ?? []
      const project = clientProjects.length && Math.random() < 0.5 ? pick(clientProjects) : null

      const hours = i === numRows - 1 ? remaining : Math.round((remaining / 2) * 2) / 2
      remaining = Math.round((remaining - hours) * 2) / 2

      rows.push({
        user_id: user.id,
        client_id: client.id,
        project_id: project ? project.id : null,
        task_id: task.id,
        entry_date: date,
        hours: Math.max(0.5, hours),
        notes: SEED_MARKER,
        exported: false,
      })
    }
  }

  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('time_entries').insert(rows.slice(i, i + BATCH))
    if (error) throw error
  }

  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  return {
    user: { id: user.id, email: user.email, full_name: user.full_name },
    daysSeeded: dates.length,
    entriesInserted: rows.length,
    totalHours,
  }
}

async function handle(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = request.nextUrl.searchParams.get('email')

  try {
    const result = await runSeed(email)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

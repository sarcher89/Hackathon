import { createClient } from '@supabase/supabase-js'

const TARGET_EMAIL = 'scott.david.archer@gmail.com'
const HOURS_PER_DAY = 8
const MONTHS_BACK = 2

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

function weekdaysBetween(start, end) {
  const days = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) {
      days.push(cursor.toISOString().slice(0, 10))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

async function main() {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', TARGET_EMAIL)
    .maybeSingle()

  if (userError) throw userError
  if (!user) {
    throw new Error(
      `No row in public.users with email ${TARGET_EMAIL}. This user needs to sign in at least once (to auto-provision their users row) before seeding, or be created manually.`
    )
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (clientError) throw clientError
  if (!client) throw new Error('No rows in public.clients — cannot pick a client_id')

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, name')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (taskError) throw taskError
  if (!task) throw new Error('No rows in public.tasks — cannot pick a task_id')

  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - MONTHS_BACK)

  const dates = weekdaysBetween(start, end)

  const { data: existing, error: existingError } = await supabase
    .from('time_entries')
    .select('entry_date')
    .eq('user_id', user.id)
    .gte('entry_date', dates[0])
    .lte('entry_date', dates[dates.length - 1])
  if (existingError) throw existingError

  const existingDates = new Set((existing ?? []).map((row) => row.entry_date))
  const newDates = dates.filter((d) => !existingDates.has(d))

  if (existingDates.size > 0) {
    console.log(`Skipping ${existingDates.size} date(s) that already have an entry for this user.`)
  }

  if (newDates.length === 0) {
    console.log('Nothing to insert — all dates already have entries.')
    return
  }

  const rows = newDates.map((entry_date) => ({
    user_id: user.id,
    client_id: client.id,
    project_id: null,
    task_id: task.id,
    entry_date,
    hours: HOURS_PER_DAY,
    notes: 'Dummy seed data',
    exported: false,
  }))

  console.log(`Seeding ${rows.length} weekday entries for ${user.full_name} (${user.email})`)
  console.log(`Client: ${client.name} | Task: ${task.name}`)
  console.log(`Range: ${newDates[0]} .. ${newDates[newDates.length - 1]}`)

  const { error: insertError } = await supabase.from('time_entries').insert(rows)
  if (insertError) throw insertError

  console.log(`Done. Inserted ${rows.length} rows.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})

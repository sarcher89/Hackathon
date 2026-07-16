import { createClient } from '@supabase/supabase-js'

const TARGET_EMAIL = 'scott.david.archer@gmail.com'
const HOURS_PER_DAY = 8
const MONTHS_BACK = 2
const CLOCK_IN_UTC_HOUR = 13 // 9am EDT
const CLOCK_OUT_UTC_HOUR = 21 // 5pm EDT

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

  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - MONTHS_BACK)

  const dates = weekdaysBetween(start, end)

  const { data: existing, error: existingError } = await supabase
    .from('clock_sessions')
    .select('entry_date')
    .eq('user_id', user.id)
    .gte('entry_date', dates[0])
    .lte('entry_date', dates[dates.length - 1])
  if (existingError) throw existingError

  const existingDates = new Set((existing ?? []).map((row) => row.entry_date))
  const newDates = dates.filter((d) => !existingDates.has(d))

  if (existingDates.size > 0) {
    console.log(`Skipping ${existingDates.size} date(s) that already have a clock session for this user.`)
  }

  if (newDates.length === 0) {
    console.log('Nothing to insert — all dates already have sessions.')
    return
  }

  const rows = newDates.map((entry_date) => ({
    user_id: user.id,
    entry_date,
    clocked_in_at: `${entry_date}T${String(CLOCK_IN_UTC_HOUR).padStart(2, '0')}:00:00.000Z`,
    clocked_out_at: `${entry_date}T${String(CLOCK_OUT_UTC_HOUR).padStart(2, '0')}:00:00.000Z`,
    hours: HOURS_PER_DAY,
  }))

  console.log(`Seeding ${rows.length} weekday clock sessions for ${user.full_name} (${user.email})`)
  console.log(`Range: ${newDates[0]} .. ${newDates[newDates.length - 1]}`)

  const { error: insertError } = await supabase.from('clock_sessions').insert(rows)
  if (insertError) throw insertError

  console.log(`Done. Inserted ${rows.length} rows.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})

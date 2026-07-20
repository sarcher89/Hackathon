'use server'

import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { getPeriodStart, formatPeriodRange, toISODate } from '@/lib/dates'

export interface MyPayPeriodOption {
  periodStart: string
  label: string
}

export async function getMyPayPeriods(): Promise<MyPayPeriodOption[]> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return []

  const { data, error } = await supabase
    .from('clock_sessions')
    .select('entry_date')
    .eq('user_id', user.id)
    .order('entry_date')

  if (error) return []

  const periodStarts = new Set<string>()
  periodStarts.add(toISODate(getPeriodStart(new Date())))
  for (const row of data ?? []) {
    periodStarts.add(toISODate(getPeriodStart(new Date(row.entry_date + 'T00:00:00'))))
  }

  return Array.from(periodStarts)
    .sort((a, b) => b.localeCompare(a))
    .map(periodStart => ({
      periodStart,
      label: formatPeriodRange(new Date(periodStart + 'T00:00:00')),
    }))
}

export async function clockIn(): Promise<{
  session: { id: string; clockedInAt: string } | null
  error?: string
}> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { session: null, error: 'Not authenticated' }

  const now = new Date()

  const { data, error } = await supabase
    .from('clock_sessions')
    .insert({
      user_id: user.id,
      clocked_in_at: now.toISOString(),
      entry_date: toISODate(now),
    })
    .select('id, clocked_in_at')
    .single()

  if (error || !data) return { session: null, error: error?.message }
  return { session: { id: data.id, clockedInAt: data.clocked_in_at } }
}

export async function clockOut(
  sessionId: string
): Promise<{ hours: number | null; entryDate?: string; error?: string }> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { hours: null, error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('clock_sessions')
    .select('clocked_in_at, entry_date')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) return { hours: null, error: 'Session not found' }

  const clockedOutAt = new Date()
  const clockedInAt = new Date(session.clocked_in_at)
  const rawMinutes = (clockedOutAt.getTime() - clockedInAt.getTime()) / 60000
  const roundedMinutes = Math.round(rawMinutes / 15) * 15
  const hours = Math.round((roundedMinutes / 60) * 100) / 100

  const { error } = await supabase
    .from('clock_sessions')
    .update({ clocked_out_at: clockedOutAt.toISOString(), hours })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) return { hours: null, error: error.message }
  return { hours, entryDate: session.entry_date }
}

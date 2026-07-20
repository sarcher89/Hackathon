'use server'

import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { getPeriodStart, getPeriodDates, formatPeriodRange, toISODate } from '@/lib/dates'
import type { ClockSessionRow } from '@/components/TimeSheet'

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>

// If a user is still clocked in from a previous calendar day (e.g. they forgot
// to clock out, or left a session open overnight), close it out at the end of
// that day rather than letting it silently bleed hours into the next day and
// overlap with a fresh clock-in. Called defensively before clocking in and on
// page load so a stale session never lingers past midnight.
export async function autoCloseStaleSession(supabase: SupabaseServerClient, userId: string): Promise<void> {
  const { data: session } = await supabase
    .from('clock_sessions')
    .select('id, clocked_in_at, entry_date')
    .eq('user_id', userId)
    .is('clocked_out_at', null)
    .maybeSingle()

  if (!session) return

  const todayIso = toISODate(new Date())
  if (session.entry_date >= todayIso) return

  const endOfDay = new Date(session.entry_date + 'T23:59:59.999')
  const clockedInAt = new Date(session.clocked_in_at)
  const rawMinutes = (endOfDay.getTime() - clockedInAt.getTime()) / 60000
  const roundedMinutes = Math.max(0, Math.round(rawMinutes / 15) * 15)
  const hours = Math.round((roundedMinutes / 60) * 100) / 100

  await supabase
    .from('clock_sessions')
    .update({ clocked_out_at: endOfDay.toISOString(), hours })
    .eq('id', session.id)
}

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

// Used by Time Sheet, Pay Stub, and Project Log to fetch a specific pay
// period's data on demand (client-side, no navigation) so switching periods
// on one tab never affects any other tab's period.
export async function getMyClockSessionsForPeriod(weekStart: string): Promise<ClockSessionRow[]> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return []

  const periodStart = getPeriodStart(new Date(weekStart + 'T00:00:00'))
  const periodDates = getPeriodDates(periodStart).map(toISODate)

  const { data, error } = await supabase
    .from('clock_sessions')
    .select('id, entry_date, clocked_in_at, clocked_out_at, hours, notes')
    .eq('user_id', user.id)
    .gte('entry_date', periodDates[0])
    .lte('entry_date', periodDates[periodDates.length - 1])
    .order('clocked_in_at')

  if (error || !data) return []

  return data.map(s => ({
    id: s.id,
    date: s.entry_date,
    clockedInAt: s.clocked_in_at,
    clockedOutAt: s.clocked_out_at,
    hours: s.hours,
    notes: s.notes,
  }))
}

export async function clockIn(): Promise<{
  session: { id: string; clockedInAt: string } | null
  error?: string
}> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { session: null, error: 'Not authenticated' }

  await autoCloseStaleSession(supabase, user.id)

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

export async function saveClockSessionNote(
  sessionId: string,
  note: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('clock_sessions')
    .update({ notes: note.trim() || null })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
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

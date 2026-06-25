'use server'

import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { toISODate } from '@/lib/dates'

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

export async function clockOut(sessionId: string): Promise<{ hours: number | null; error?: string }> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { hours: null, error: 'Not authenticated' }

  const { data: session } = await supabase
    .from('clock_sessions')
    .select('clocked_in_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) return { hours: null, error: 'Session not found' }

  const clockedOutAt = new Date()
  const clockedInAt = new Date(session.clocked_in_at)
  const rawHours = (clockedOutAt.getTime() - clockedInAt.getTime()) / 3600000
  // Round to nearest 0.25
  const hours = Math.round(rawHours * 4) / 4

  const { error } = await supabase
    .from('clock_sessions')
    .update({ clocked_out_at: clockedOutAt.toISOString(), hours })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) return { hours: null, error: error.message }
  return { hours }
}

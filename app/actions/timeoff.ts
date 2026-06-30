'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { TimeOffType } from '@/types/database'

export interface TimeOffEntry {
  date: string
  hours: number
  type: TimeOffType
}

export async function submitTimeOffRequest(entries: TimeOffEntry[], notes?: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { error: 'Not authenticated' }

  const rows = entries.map(e => ({
    user_id: user.id,
    request_date: e.date,
    hours: e.hours,
    type: e.type,
    notes: notes ?? null,
    status: 'pending',
  }))

  const { error: insertError } = await supabase.from('time_off_requests').insert(rows)
  if (insertError) return { error: insertError.message }

  // Use service role to read all leaders/admins and write notifications (bypasses RLS)
  const service = createSupabaseServiceClient()

  const { data: admins, error: adminError } = await service
    .from('users')
    .select('id')
    .in('role', ['admin', 'leader'])

  if (adminError) console.error('Failed to fetch admins for notification:', adminError.message)

  if (admins && admins.length > 0) {
    const dateList = entries.map(e => e.date).join(', ')
    const totalHours = entries.reduce((s, e) => s + e.hours, 0)
    const notifications = admins.map(a => ({
      user_id: a.id,
      from_user_id: user.id,
      type: 'time_off_request',
      message: `${user.full_name || user.email} requested ${totalHours}h time off (${dateList})`,
      data: { entries, notes },
    }))
    const { error: notifError } = await service.from('notifications').insert(notifications)
    if (notifError) console.error('Failed to insert notifications:', notifError.message)
  }

  return {}
}

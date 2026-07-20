'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { TimeOffType, TimeOffStatus } from '@/types/database'

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

export interface TimeOffRequestWithUser {
  id: string
  userId: string
  userName: string
  userEmail: string
  date: string
  hours: number
  type: TimeOffType
  status: TimeOffStatus
  notes: string | null
  createdAt: string
}

export async function getAllTimeOffRequests(): Promise<TimeOffRequestWithUser[]> {
  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return []

  const { data, error } = await createSupabaseServiceClient()
    .from('time_off_requests')
    .select(`
      id,
      user_id,
      request_date,
      hours,
      type,
      status,
      notes,
      created_at,
      user:users!inner(full_name, email)
    `)
    .order('request_date', { ascending: false })

  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user?.full_name || r.user?.email || 'Unknown',
    userEmail: r.user?.email ?? '',
    date: r.request_date,
    hours: r.hours,
    type: r.type,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  }))
}

const BALANCE_COLUMN: Record<TimeOffType, 'vacation_hours' | 'sick_hours' | 'bereavement_hours'> = {
  vacation: 'vacation_hours',
  sick: 'sick_hours',
  bereavement: 'bereavement_hours',
}

export async function updateTimeOffRequestStatus(
  requestId: string,
  status: 'approved' | 'denied'
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) {
    return { success: false, error: 'Not authorized' }
  }

  const service = createSupabaseServiceClient()

  const { data: request, error: fetchError } = await service
    .from('time_off_requests')
    .select('user_id, hours, type, status, request_date')
    .eq('id', requestId)
    .maybeSingle()

  if (fetchError || !request) return { success: false, error: 'Request not found' }

  const { data, error } = await service
    .from('time_off_requests')
    .update({ status })
    .eq('id', requestId)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'Request not found' }

  // Deduct the approved hours from the employee's balance for that time off
  // type, but only on the pending -> approved transition (avoid double-
  // deducting if a request is somehow re-approved).
  if (status === 'approved' && request.status !== 'approved') {
    const column = BALANCE_COLUMN[request.type as TimeOffType]
    const { data: user, error: userError } = await service
      .from('users')
      .select(column)
      .eq('id', request.user_id)
      .maybeSingle()

    if (!userError && user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const current = (user as any)[column] ?? 0
      const next = Math.max(0, current - request.hours)
      await service.from('users').update({ [column]: next }).eq('id', request.user_id)
    }
  }

  // Notify the employee of the decision, but only on an actual status change.
  if (request.status !== status) {
    const dateLabel = new Date(request.request_date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const { error: notifError } = await service.from('notifications').insert({
      user_id: request.user_id,
      from_user_id: caller.id,
      type: status === 'approved' ? 'time_off_approved' : 'time_off_denied',
      message: `Your ${request.type} request for ${dateLabel} was ${status}`,
      data: { requestId, date: request.request_date, hours: request.hours, type: request.type },
    })
    if (notifError) console.error('Failed to insert time off decision notification:', notifError.message)
  }

  return { success: true }
}

export interface MyTimeOffRequest {
  id: string
  date: string
  hours: number
  type: TimeOffType
  status: TimeOffStatus
  notes: string | null
}

export async function getMyTimeOffRequests(): Promise<MyTimeOffRequest[]> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return []

  const { data, error } = await supabase
    .from('time_off_requests')
    .select('id, request_date, hours, type, status, notes')
    .eq('user_id', user.id)
    .order('request_date', { ascending: false })

  if (error) return []

  return (data ?? []).map(r => ({
    id: r.id,
    date: r.request_date,
    hours: r.hours,
    type: r.type,
    status: r.status,
    notes: r.notes,
  }))
}

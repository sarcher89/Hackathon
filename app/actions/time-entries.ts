'use server'

import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { getPeriodStart, formatPeriodRange, toISODate } from '@/lib/dates'

export interface MyPeriodOption {
  periodStart: string
  label: string
}

export async function getMyProjectLogPeriods(): Promise<MyPeriodOption[]> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return []

  const { data, error } = await supabase
    .from('time_entries')
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

export async function saveTimeEntry({
  clientId,
  projectId,
  taskId,
  date,
  hours,
  notes,
}: {
  clientId: string
  projectId: string | null
  taskId: string
  date: string
  hours: number
  notes?: string | null
}): Promise<{ success: true; id: string | null } | { success: false; error: string }> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { success: false, error: 'Not authenticated' }

  const base = supabase.from('time_entries')

  if (hours <= 0) {
    const delBase = base
      .delete()
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .eq('task_id', taskId)
      .eq('entry_date', date)

    const { error } = await (projectId
      ? delBase.eq('project_id', projectId)
      : delBase.is('project_id', null))

    if (error) return { success: false, error: error.message }
    return { success: true, id: null }
  }

  const selectBase = base
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .eq('task_id', taskId)
    .eq('entry_date', date)

  const { data: existing } = await (projectId
    ? selectBase.eq('project_id', projectId).maybeSingle()
    : selectBase.is('project_id', null).maybeSingle())

  if (existing) {
    const updatePayload: { hours: number; exported: boolean; notes?: string | null } = {
      hours,
      exported: false,
    }
    if (notes !== undefined) updatePayload.notes = notes || null

    const { data, error } = await supabase
      .from('time_entries')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, id: data.id }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      user_id: user.id,
      client_id: clientId,
      project_id: projectId,
      task_id: taskId,
      entry_date: date,
      hours,
      exported: false,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function clearRowEntries({
  clientId,
  projectId,
  taskId,
  dates,
}: {
  clientId: string
  projectId: string | null
  taskId: string
  dates: string[]
}): Promise<void> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return

  const deleteBase = supabase
    .from('time_entries')
    .delete()
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .eq('task_id', taskId)
    .in('entry_date', dates)

  await (projectId
    ? deleteBase.eq('project_id', projectId)
    : deleteBase.is('project_id', null))
}

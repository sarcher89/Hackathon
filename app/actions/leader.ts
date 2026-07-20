'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { getPeriodStart, getPeriodDates, formatPeriodRange, toISODate } from '@/lib/dates'
import type { ExportEntry, ExportClockSession } from '@/components/LeaderGrid'

export async function markEntriesExported(entryIds: string[]): Promise<void> {
  if (entryIds.length === 0) return

  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user || (user.role !== 'leader' && user.role !== 'admin')) return

  await createSupabaseServiceClient()
    .from('time_entries')
    .update({ exported: true })
    .in('id', entryIds)
}

export interface PayPeriodSummary {
  periodStart: string
  label: string
  hours: number
  entryCount: number
}

export async function getEmployeePayPeriods(userId: string): Promise<PayPeriodSummary[]> {
  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return []

  const { data, error } = await createSupabaseServiceClient()
    .from('time_entries')
    .select('entry_date, hours')
    .eq('user_id', userId)
    .order('entry_date')

  if (error || !data) return []

  const periods = new Map<string, { hours: number; entryCount: number }>()
  for (const row of data) {
    const periodStart = toISODate(getPeriodStart(new Date(row.entry_date + 'T00:00:00')))
    const existing = periods.get(periodStart) ?? { hours: 0, entryCount: 0 }
    existing.hours += row.hours
    existing.entryCount += 1
    periods.set(periodStart, existing)
  }

  return Array.from(periods.entries())
    .map(([periodStart, summary]) => ({
      periodStart,
      label: formatPeriodRange(new Date(periodStart + 'T00:00:00')),
      hours: summary.hours,
      entryCount: summary.entryCount,
    }))
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
}

export async function getPayPeriodEntries(
  userId: string,
  periodStarts: string[]
): Promise<ExportEntry[]> {
  if (periodStarts.length === 0) return []

  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return []

  const wantedPeriods = new Set(periodStarts)
  const ranges = periodStarts.map(ps => {
    const isoDates = getPeriodDates(new Date(ps + 'T00:00:00')).map(toISODate)
    return { start: isoDates[0], end: isoDates[isoDates.length - 1] }
  })
  const rangeStart = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start)
  const rangeEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end)

  const { data, error } = await createSupabaseServiceClient()
    .from('time_entries')
    .select(`
      id,
      entry_date,
      hours,
      notes,
      exported,
      user:users!inner(id, full_name, email),
      client:clients!inner(name),
      project:projects(name),
      task:tasks!inner(name, category)
    `)
    .eq('user_id', userId)
    .gte('entry_date', rangeStart)
    .lte('entry_date', rangeEnd)
    .order('entry_date')

  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter(r => wantedPeriods.has(toISODate(getPeriodStart(new Date(r.entry_date + 'T00:00:00')))))
    .map(r => ({
      id: r.id,
      userId: r.user?.id ?? '',
      userName: r.user?.full_name || r.user?.email || 'Unknown',
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
}

export async function getAllPayPeriods(): Promise<PayPeriodSummary[]> {
  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return []

  const { data, error } = await createSupabaseServiceClient()
    .from('time_entries')
    .select('entry_date, hours')
    .order('entry_date')

  if (error || !data) return []

  const periods = new Map<string, { hours: number; entryCount: number }>()
  for (const row of data) {
    const periodStart = toISODate(getPeriodStart(new Date(row.entry_date + 'T00:00:00')))
    const existing = periods.get(periodStart) ?? { hours: 0, entryCount: 0 }
    existing.hours += row.hours
    existing.entryCount += 1
    periods.set(periodStart, existing)
  }

  return Array.from(periods.entries())
    .map(([periodStart, summary]) => ({
      periodStart,
      label: formatPeriodRange(new Date(periodStart + 'T00:00:00')),
      hours: summary.hours,
      entryCount: summary.entryCount,
    }))
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
}

export async function getPayPeriodEntriesAllUsers(periodStarts: string[]): Promise<ExportEntry[]> {
  if (periodStarts.length === 0) return []

  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return []

  const wantedPeriods = new Set(periodStarts)
  const ranges = periodStarts.map(ps => {
    const isoDates = getPeriodDates(new Date(ps + 'T00:00:00')).map(toISODate)
    return { start: isoDates[0], end: isoDates[isoDates.length - 1] }
  })
  const rangeStart = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start)
  const rangeEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end)

  const { data, error } = await createSupabaseServiceClient()
    .from('time_entries')
    .select(`
      id,
      entry_date,
      hours,
      notes,
      exported,
      user:users!inner(id, full_name, email),
      client:clients!inner(name),
      project:projects(name),
      task:tasks!inner(name, category)
    `)
    .gte('entry_date', rangeStart)
    .lte('entry_date', rangeEnd)
    .order('entry_date')
    .order('full_name', { foreignTable: 'user' })

  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter(r => wantedPeriods.has(toISODate(getPeriodStart(new Date(r.entry_date + 'T00:00:00')))))
    .map(r => ({
      id: r.id,
      userId: r.user?.id ?? '',
      userName: r.user?.full_name || r.user?.email || 'Unknown',
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
}

export async function getPayPeriodClockSessionsAllUsers(periodStarts: string[]): Promise<ExportClockSession[]> {
  if (periodStarts.length === 0) return []

  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return []

  const wantedPeriods = new Set(periodStarts)
  const ranges = periodStarts.map(ps => {
    const isoDates = getPeriodDates(new Date(ps + 'T00:00:00')).map(toISODate)
    return { start: isoDates[0], end: isoDates[isoDates.length - 1] }
  })
  const rangeStart = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start)
  const rangeEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end)

  const { data, error } = await createSupabaseServiceClient()
    .from('clock_sessions')
    .select(`
      id,
      entry_date,
      clocked_in_at,
      clocked_out_at,
      hours,
      user:users!inner(id, email)
    `)
    .gte('entry_date', rangeStart)
    .lte('entry_date', rangeEnd)
    .order('clocked_in_at')

  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter(r => wantedPeriods.has(toISODate(getPeriodStart(new Date(r.entry_date + 'T00:00:00')))))
    .map(r => ({
      id: r.id,
      userId: r.user?.id ?? '',
      userEmail: r.user?.email ?? '',
      date: r.entry_date,
      clockedInAt: r.clocked_in_at,
      clockedOutAt: r.clocked_out_at,
      hours: r.hours,
    }))
}

export async function getPayPeriodClockSessions(
  userId: string,
  periodStarts: string[]
): Promise<ExportClockSession[]> {
  if (periodStarts.length === 0) return []

  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return []

  const wantedPeriods = new Set(periodStarts)
  const ranges = periodStarts.map(ps => {
    const isoDates = getPeriodDates(new Date(ps + 'T00:00:00')).map(toISODate)
    return { start: isoDates[0], end: isoDates[isoDates.length - 1] }
  })
  const rangeStart = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start)
  const rangeEnd = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end)

  const { data, error } = await createSupabaseServiceClient()
    .from('clock_sessions')
    .select(`
      id,
      entry_date,
      clocked_in_at,
      clocked_out_at,
      hours,
      user:users!inner(id, email)
    `)
    .eq('user_id', userId)
    .gte('entry_date', rangeStart)
    .lte('entry_date', rangeEnd)
    .order('clocked_in_at')

  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter(r => wantedPeriods.has(toISODate(getPeriodStart(new Date(r.entry_date + 'T00:00:00')))))
    .map(r => ({
      id: r.id,
      userId: r.user?.id ?? '',
      userEmail: r.user?.email ?? '',
      date: r.entry_date,
      clockedInAt: r.clocked_in_at,
      clockedOutAt: r.clocked_out_at,
      hours: r.hours,
    }))
}

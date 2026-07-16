'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'

export async function updateUserProfile(
  userId: string,
  fields: { full_name?: string; department?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) {
    return { success: false, error: 'Not authorized' }
  }

  const { data, error } = await createSupabaseServiceClient()
    .from('users')
    .update(fields)
    .eq('id', userId)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'User not found' }
  return { success: true }
}

export async function setUserWage(
  userId: string,
  wage: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) {
    return { success: false, error: 'Not authorized' }
  }

  const { data, error } = await createSupabaseServiceClient()
    .from('users')
    .update({ hourly_wage: wage })
    .eq('id', userId)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'User not found' }
  return { success: true }
}

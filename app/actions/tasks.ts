'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { Task } from '@/types/database'

export async function createTask(
  name: string
): Promise<{ success: true; task: Task } | { success: false; error: string }> {
  const supabase = createSupabaseServerClient()
  const user = await getOrCreateUser(supabase)
  if (!user) return { success: false, error: 'Not authenticated' }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Task name is required' }

  const { data, error } = await createSupabaseServiceClient()
    .from('tasks')
    .insert({ name: trimmed, category: 'Custom', system: 'both', sort_order: 999 })
    .select('*')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create task' }
  return { success: true, task: data as Task }
}

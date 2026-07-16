'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'

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

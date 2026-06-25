import { SupabaseClient } from '@supabase/supabase-js'
import { User } from '@/types/database'

/**
 * Fetches the public.users row for the authenticated session user.
 * If no row exists yet (first login), creates one with role 'ic'.
 */
export async function getOrCreateUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authUser.id)
    .single()

  if (existing) return existing as User

  const { data: created, error } = await supabase
    .from('users')
    .insert({
      auth_id: authUser.id,
      full_name: authUser.user_metadata?.full_name ?? '',
      email: authUser.email ?? '',
      role: 'ic',
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create user row:', error)
    return null
  }

  return created as User
}

'use server'

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import { User, UserRole, Client, ClientSystem, Project } from '@/types/database'

function generatePassword(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8)
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient()
  const caller = await getOrCreateUser(supabase)
  if (!caller || (caller.role !== 'leader' && caller.role !== 'admin')) return null
  return caller
}

export async function createEmployee({
  email,
  fullName,
  department,
  role,
}: {
  email: string
  fullName: string
  department: string
  role: UserRole
}): Promise<{ success: true; tempPassword: string; user: User } | { success: false; error: string }> {
  const caller = await requireAdmin()
  if (!caller) return { success: false, error: 'Not authorized' }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) return { success: false, error: 'Email is required' }

  const service = createSupabaseServiceClient()

  const { data: existing } = await service
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .maybeSingle()
  if (existing) return { success: false, error: 'An employee with this email already exists' }

  const tempPassword = generatePassword()

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: trimmedEmail,
    password: tempPassword,
    email_confirm: true,
  })
  if (authError || !authUser?.user) {
    return { success: false, error: authError?.message ?? 'Failed to create account' }
  }

  const { data: newUser, error: insertError } = await service
    .from('users')
    .insert({
      auth_id: authUser.user.id,
      email: trimmedEmail,
      full_name: fullName.trim(),
      department: department || null,
      role,
    })
    .select('*')
    .single()

  if (insertError || !newUser) {
    // Roll back the auth user so we don't leave an orphaned account with no profile row.
    await service.auth.admin.deleteUser(authUser.user.id)
    return { success: false, error: insertError?.message ?? 'Failed to create profile' }
  }

  return { success: true, tempPassword, user: newUser as User }
}

export async function createClient(
  name: string,
  system: ClientSystem
): Promise<{ success: true; client: Client } | { success: false; error: string }> {
  const caller = await requireAdmin()
  if (!caller) return { success: false, error: 'Not authorized' }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Client name is required' }

  const { data, error } = await createSupabaseServiceClient()
    .from('clients')
    .insert({ name: trimmed, system, active: true })
    .select('*')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create client' }
  return { success: true, client: data as Client }
}

export async function createProject(
  name: string,
  clientId: string
): Promise<{ success: true; project: Project } | { success: false; error: string }> {
  const caller = await requireAdmin()
  if (!caller) return { success: false, error: 'Not authorized' }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Project name is required' }
  if (!clientId) return { success: false, error: 'Client is required' }

  const { data, error } = await createSupabaseServiceClient()
    .from('projects')
    .insert({ name: trimmed, client_id: clientId, active: true })
    .select('*')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create project' }
  return { success: true, project: data as Project }
}

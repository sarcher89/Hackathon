import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Plain client — no session awareness.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service role client — bypasses RLS. Server-side only, never expose to browser.
export function createSupabaseServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Browser client with session awareness — use in Client Components.
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server client — reads AND writes session cookies so token refresh works
// in both Server Components and Server Actions.
export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cookieStore.set({ name, value, ...(options as any) })
        } catch {
          // In pure Server Components cookies are read-only; safe to ignore.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cookieStore.set({ name, value: '', ...(options as any) })
        } catch {
          // Ignore in Server Components.
        }
      },
    },
  })
}

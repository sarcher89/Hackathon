import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Plain client — no session awareness.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Browser client with session awareness — use in Client Components.
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server Component client — reads session from request cookies.
// Must be called inside an async Server Component or Route Handler.
export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}

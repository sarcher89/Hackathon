'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { User } from '@/types/database'

interface NavBarProps {
  user: User | null
}

export default function NavBar({ user }: NavBarProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-slate-800 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <span className="text-sm font-semibold tracking-wide uppercase">
            PS Time Tracker
          </span>
          {user && (
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-slate-300 sm:block">
                {user.full_name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600 transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

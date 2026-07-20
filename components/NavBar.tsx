'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { User } from '@/types/database'
import NotificationBell from '@/components/NotificationBell'

interface NavBarProps {
  user: User | null
}

function PlanetDDSLogo() {
  return (
    <div className="flex items-center gap-3">
      {/* Waveform bars mark */}
      <svg viewBox="0 0 48 40" className="h-8 w-auto" fill="none">
        {/* Tallest bar – far left */}
        <rect x="0"  y="2"  width="7" height="36" rx="3.5" fill="#0057FF" />
        {/* Short bar */}
        <rect x="11" y="14" width="7" height="24" rx="3.5" fill="#0057FF" />
        {/* Medium bar */}
        <rect x="22" y="8"  width="7" height="30" rx="3.5" fill="#0057FF" />
        {/* Short bar */}
        <rect x="33" y="18" width="7" height="20" rx="3.5" fill="#0057FF" />
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span className="text-xl font-bold tracking-tight" style={{ color: '#0B1460' }}>
          planet
        </span>
        <span className="text-xs font-bold tracking-widest" style={{ color: '#0B1460' }}>
          DDS
        </span>
      </div>

      {/* App name separator */}
      <div className="ml-3 pl-3 border-l border-slate-300">
        <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: '#0B1460' }}>
          PS Time Tracker
        </span>
      </div>
    </div>
  )
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
    <header style={{ backgroundColor: '#E8EEF8' }} className="border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <PlanetDDSLogo />
          {user && (
            <div className="flex items-center gap-4">
              <span className="hidden text-sm sm:block" style={{ color: '#0B1460' }}>
                {user.full_name || user.email}
              </span>
              <button
                onClick={handleLogout}
                style={{ backgroundColor: '#0B1460' }}
                className="rounded px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Log Out
              </button>
              <NotificationBell />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

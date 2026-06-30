'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { User } from '@/types/database'

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
              <button
                className="rounded-full p-1.5 hover:bg-slate-200 transition-colors relative"
                aria-label="Notifications"
                style={{ color: '#0B1460' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

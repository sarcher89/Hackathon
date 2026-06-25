import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const user = await getOrCreateUser(supabase)

  if (!user) redirect('/login')

  if (user.role === 'leader' || user.role === 'admin') redirect('/leader')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="text-xl font-semibold text-slate-800">Weekly Time Entry</h2>
      <p className="mt-2 text-sm text-slate-500">
        Time entry grid coming next — foundation is in place.
      </p>
    </div>
  )
}

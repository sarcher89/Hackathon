import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import { getOrCreateUser } from '@/lib/auth'
import NavBar from '@/components/NavBar'

export default async function LeaderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const user = await getOrCreateUser(supabase)

  if (!user || (user.role !== 'leader' && user.role !== 'admin')) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar user={user} />
      <main className="flex-1">{children}</main>
    </div>
  )
}

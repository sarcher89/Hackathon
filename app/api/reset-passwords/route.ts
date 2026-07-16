import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { User } from '@/types/database'

// Temporary admin endpoint used to reset the ic (regular) and leader/admin
// users' passwords in a hosted environment where no local shell is available.
// Guarded by SEED_SECRET so it can't be triggered by an arbitrary visitor.
// Delete this route once the reset is done.

export const dynamic = 'force-dynamic'

const NEW_PASSWORD = '8501176'

async function findUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  roles: string[],
  emailOverride: string | null
): Promise<{ user: User | null; error: string | null }> {
  let query = supabase.from('users').select('*').in('role', roles)
  if (emailOverride) query = query.eq('email', emailOverride)

  const { data, error } = await query
  if (error) return { user: null, error: error.message }

  if (!data || data.length === 0) {
    return { user: null, error: `No user found with role in [${roles.join(', ')}]` }
  }
  if (data.length > 1 && !emailOverride) {
    return {
      user: null,
      error: `Multiple users found with role in [${roles.join(', ')}]: ${data
        .map((u: User) => u.email)
        .join(', ')} — retry with an explicit email param.`,
    }
  }

  return { user: data[0] as User, error: null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resetOne(supabase: any, user: User) {
  const { error } = await supabase.auth.admin.updateUserById(user.auth_id, {
    password: NEW_PASSWORD,
  })
  return {
    email: user.email,
    role: user.role,
    success: !error,
    error: error?.message ?? null,
  }
}

async function handle(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey)

  const icEmail = request.nextUrl.searchParams.get('icEmail')
  const leaderEmail = request.nextUrl.searchParams.get('leaderEmail')

  const [ic, leader] = await Promise.all([
    findUser(supabase, ['ic'], icEmail),
    findUser(supabase, ['leader', 'admin'], leaderEmail),
  ])

  if (!ic.user || !leader.user) {
    return NextResponse.json(
      { success: false, icError: ic.error, leaderError: leader.error },
      { status: 400 }
    )
  }

  const results = await Promise.all([resetOne(supabase, ic.user), resetOne(supabase, leader.user)])

  return NextResponse.json({ success: results.every(r => r.success), results })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

import { redirect } from 'next/navigation'

// Root route — redirect to the login page.
// After successful auth, login will redirect to /dashboard.
export default function RootPage() {
  redirect('/login')
}

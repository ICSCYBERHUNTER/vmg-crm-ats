import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

// This layout wraps all dashboard pages (candidates, companies, jobs, etc.)
// It's a Server Component — it fetches the current user before rendering.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Safety net: middleware should have redirected already, but just in case
  if (!user) {
    redirect('/login')
  }

  return (
    // Full-screen flex: sidebar on the left, content on the right
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: hidden on mobile, visible on md+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Main area: header on top, scrollable content below */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

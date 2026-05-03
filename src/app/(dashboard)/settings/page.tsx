import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { SettingsStatusBanner } from '@/components/settings/SettingsStatusBanner'
import { GoogleTasksIntegrationRow } from '@/components/settings/GoogleTasksIntegrationRow'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: googleConnection } = await supabase
    .from('oauth_connections')
    .select('provider_account_email, is_active, created_at, tasklist_id, tasklist_name')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle()

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account and integrations.
        </p>
      </div>

      <Suspense>
        <SettingsStatusBanner />
      </Suspense>

      <div className="space-y-6">
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Integrations
          </h2>

          <Card>
            <CardContent className="p-6">
              <GoogleTasksIntegrationRow connection={googleConnection} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { SettingsStatusBanner } from '@/components/settings/SettingsStatusBanner'
import { GoogleTasksIntegrationRow } from '@/components/settings/GoogleTasksIntegrationRow'
import { MicroslopIntegrationRow } from '@/components/settings/MicroslopIntegrationRow'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch both provider connections in parallel.
  const [googleResult, microsoftResult] = await Promise.all([
    supabase
      .from('oauth_connections')
      .select('provider_account_email, is_active, created_at, tasklist_id, tasklist_name')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('oauth_connections')
      .select('provider_account_email, is_active, created_at')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const googleConnection = googleResult.data
  const microsoftConnection = microsoftResult.data

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

          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <GoogleTasksIntegrationRow connection={googleConnection} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <MicroslopIntegrationRow connection={microsoftConnection} />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}

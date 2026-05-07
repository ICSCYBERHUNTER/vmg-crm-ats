import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/microsoft/oauth'
import { encrypt } from '@/lib/crypto'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?microsoft=error&reason=${encodeURIComponent(error)}`, request.url)
    )
  }

  const cookieStore = await cookies()
  const stateCookie = cookieStore.get('microsoft_oauth_state')?.value
  cookieStore.set('microsoft_oauth_state', '', { maxAge: 0, path: '/' })

  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL('/settings?microsoft=error&reason=invalid_state', request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?microsoft=error&reason=missing_code', request.url)
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Session expired or never existed during the OAuth round-trip.
    // Tell the user what happened so /login can show a helpful message.
    return NextResponse.redirect(
      new URL('/login?reason=session_expired&from=microsoft_oauth', request.url)
    )
  }

  try {
    const { accessToken, refreshToken, expiresIn, scope } = await exchangeCodeForTokens(code)
    const { email } = await getUserInfo(accessToken)

    const encryptedRefreshToken = encrypt(refreshToken)
    const encryptedAccessToken = encrypt(accessToken)
    const accessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error: upsertError } = await supabase.from('oauth_connections').upsert(
      {
        user_id: user.id,
        provider: 'microsoft',
        provider_account_email: email,
        encrypted_refresh_token: encryptedRefreshToken,
        encrypted_access_token: encryptedAccessToken,
        access_token_expires_at: accessTokenExpiresAt,
        scope,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    )

    if (upsertError) {
      console.error('[microsoft-oauth] callback upsert failed:', upsertError)
      return NextResponse.redirect(
        new URL('/settings?microsoft=error&reason=connection_failed', request.url)
      )
    }

    return NextResponse.redirect(new URL('/settings?microsoft=connected', request.url))
  } catch (err) {
    console.error('[microsoft-oauth] callback unexpected error:', err)
    return NextResponse.redirect(
      new URL('/settings?microsoft=error&reason=connection_failed', request.url)
    )
  }
}

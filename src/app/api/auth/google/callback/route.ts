import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/google/oauth'
import { encrypt } from '@/lib/crypto'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // User denied or Google returned an error
  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?google=error&reason=${encodeURIComponent(error)}`, request.url)
    )
  }

  // CSRF check
  const cookieStore = await cookies()
  const stateCookie = cookieStore.get('google_oauth_state')?.value

  // Delete the state cookie regardless of outcome
  cookieStore.set('google_oauth_state', '', { maxAge: 0, path: '/' })

  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(
      new URL('/settings?google=error&reason=invalid_state', request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?google=error&reason=missing_code', request.url)
    )
  }

  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
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
        provider: 'google',
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
      console.error('Google OAuth callback: failed to upsert oauth_connections:', upsertError)
      return NextResponse.redirect(
        new URL('/settings?google=error&reason=connection_failed', request.url)
      )
    }

    return NextResponse.redirect(new URL('/settings?google=connected', request.url))
  } catch (err) {
    console.error('Google OAuth callback: unexpected error during token exchange or storage:', err)
    return NextResponse.redirect(
      new URL('/settings?google=error&reason=connection_failed', request.url)
    )
  }
}

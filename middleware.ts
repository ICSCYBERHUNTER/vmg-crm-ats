import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // We start with the default "let the request through" response.
  // We may replace this below if we need to redirect or refresh cookies.
  let supabaseResponse = NextResponse.next({ request })

  // Create a Supabase client that can read/write cookies in the middleware.
  // This is the official Supabase SSR pattern for Next.js.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // First write cookies to the incoming request object
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Then recreate the response so the cookies appear in the outgoing response too
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() refreshes the session if it's expired.
  // Do not use getSession() here — it doesn't refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'

  // Not logged in and trying to access any page other than /login → redirect to login
  if (!user && !isLoginPage) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Logged in and on the login page → redirect to /candidates
  if (user && isLoginPage) {
    const candidatesUrl = request.nextUrl.clone()
    candidatesUrl.pathname = '/candidates'
    return NextResponse.redirect(candidatesUrl)
  }

  // All other cases: let the request through (with refreshed cookies if any)
  return supabaseResponse
}

// Tell Next.js which paths this middleware should run on.
// We skip static files (_next/static, images, favicon) — those don't need auth.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

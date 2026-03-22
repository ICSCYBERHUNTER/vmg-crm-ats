import { redirect } from 'next/navigation'

// The root URL "/" just redirects to /candidates.
// Middleware guarantees only logged-in users reach this page.
// Unauthenticated users are already redirected to /login by middleware.ts.
export default function RootPage() {
  redirect('/dashboard')
}

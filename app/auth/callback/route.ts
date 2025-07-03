import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // CORRECTION: On redirige vers la page d'accueil.
      // Next.js gère la redirection, et lorsque le client arrivera sur la page '/', 
      // AuthProvider se chargera avec la session déjà établie par le cookie.
      // C'est une redirection "hard".
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error("Error exchanging code for session:", error.message);
    }
  }

  // En cas d'erreur ou si aucun code n'est présent, redirige vers une page d'erreur.
  console.error("Authentication callback error or no code provided.");
  const errorUrl = new URL('/auth/auth-error', origin)
  errorUrl.searchParams.set('message', 'Could not authenticate user. Please try again.')
  return NextResponse.redirect(errorUrl)
}
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Rafraîchit la session de l'utilisateur si le token d'accès a expiré.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // **CORRECTION : On ignore la route de callback pour ne pas interrompre le flux OAuth**
  if (pathname.startsWith('/auth/callback')) {
    return response;
  }
  
  // Règle 1: Si l'utilisateur n'est PAS connecté et essaie d'accéder à une page protégée.
  // (On exclut aussi la page d'erreur d'authentification des pages protégées)
  if (!user && !pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Règle 2: Si l'utilisateur EST connecté et essaie d'accéder aux pages de connexion/inscription.
  if (user && pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/' // Redirige vers la page d'accueil des chats
    return NextResponse.redirect(url)
  }

  // Si aucune règle de redirection ne s'applique, on laisse la requête continuer.
  return response
}

// La configuration du matcher ne change pas, elle est déjà correcte.
export const config = {
  matcher: [
    /*
     * Appliquer le middleware à tous les chemins sauf ceux qui commencent par :
     * - _next/static (fichiers statiques)
     * - _next/image (fichiers d'optimisation d'image)
     * - favicon.ico (fichier favicon)
     * - Les fichiers image (png, jpg, etc.)
     * Cela évite que le middleware ne s'exécute sur des ressources statiques inutiles.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
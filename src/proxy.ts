import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'mg_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/apple-touch-icon.png' ||
    pathname.startsWith('/icon-')
  ) {
    return NextResponse.next()
  }

  // iron-session stores encrypted data in the cookie — just check it exists
  const session = request.cookies.get(SESSION_COOKIE)?.value
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|apple-touch-icon.png|icon-192.png|icon-512.png|sw.js).*)'],
}

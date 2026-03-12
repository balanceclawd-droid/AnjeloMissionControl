import { NextRequest, NextResponse } from 'next/server'

function unauthorizedResponse() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Mission Control"',
    },
  })
}

function isProtectedPath(pathname: string) {
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap')
  ) {
    return false
  }

  return true
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD

  // Fail open until env vars are configured in Vercel/local runtime.
  // This lets us deploy safely first, then activate protection by setting env vars.
  if (!expectedUser || !expectedPass) {
    return NextResponse.next()
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ')) {
    return unauthorizedResponse()
  }

  try {
    const encoded = authHeader.split(' ')[1]
    const decoded = atob(encoded)
    const separatorIndex = decoded.indexOf(':')
    const username = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded
    const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : ''

    if (username !== expectedUser || password !== expectedPass) {
      return unauthorizedResponse()
    }
  } catch {
    return unauthorizedResponse()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

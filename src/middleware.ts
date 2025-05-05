import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define paths that require authentication
const protectedPaths = ['/dashboard', '/profile', '/play', '/history', '/stats', '/friends'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userCookie = request.cookies.get('firebaseAuthCookie'); // Adjust cookie name if needed

  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtected && !userCookie) {
    // Redirect to login page if trying to access a protected route without being authenticated
    const url = request.nextUrl.clone();
    url.pathname = '/login'; // Redirect to your login page
    url.searchParams.set('redirectedFrom', pathname); // Optional: pass original path
    return NextResponse.redirect(url);
  }

  // Allow the request to proceed if it's not a protected route or if the user is authenticated
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - _auth (Firebase auth helper files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|_auth).*)',
  ],
};

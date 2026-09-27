import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('kaaya_admin_session')?.value;
  if (request.nextUrl.pathname.startsWith('/admin/dashboard') && !token) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/dashboard/:path*'] };

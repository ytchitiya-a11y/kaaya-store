const { NextResponse } = require('next/server');
const { getAdminByUsername } = require('../../../../lib/db');
const { verifyPassword, signSession, COOKIE_NAME } = require('../../../../lib/auth');

async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  const admin = await getAdminByUsername(username);
  if (!admin) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });

  const token = signSession(admin);
  const response = NextResponse.json({ ok: true, username: admin.username });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

module.exports = { POST };

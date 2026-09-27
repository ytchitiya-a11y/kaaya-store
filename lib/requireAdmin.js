const { verifySession, COOKIE_NAME } = require('./auth');

function requireAdmin(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

module.exports = { requireAdmin };

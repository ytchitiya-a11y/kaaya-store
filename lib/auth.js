const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kaaya-dev-secret-change-me-in-production';
const COOKIE_NAME = 'kaaya_admin_session';

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
function signSession(admin) {
  return jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '7d' });
}
function verifySession(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; }
}

module.exports = { hashPassword, verifyPassword, signSession, verifySession, COOKIE_NAME };

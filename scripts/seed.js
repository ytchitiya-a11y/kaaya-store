require('../lib/loadEnv').loadEnvLocal();
const { getAdminByUsername, createAdmin } = require('../lib/db');
const { hashPassword } = require('../lib/auth');

async function main() {
  const username = process.env.SEED_ADMIN_USER || 'admin';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@kaaya.com';
  const password = process.env.SEED_ADMIN_PASS || 'admin123';

  const existing = await getAdminByUsername(username);
  if (existing) {
    console.log(`Admin "${username}" already exists — skipping.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  await createAdmin({ username, email, passwordHash });
  console.log('----------------------------------------');
  console.log('Admin account created successfully!');
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('(Stored as a bcrypt hash in Postgres, never in plain text.)');
  console.log('----------------------------------------');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

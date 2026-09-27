# KAAYA — Clothing Store (Postgres + Cloudinary edition)

This is the fully persistent version of your store: it uses **Postgres** (via Neon —
free, and it's what Vercel Postgres runs on under the hood) for the database and
**Cloudinary** for image/video hosting. Unlike the SQLite version, this one works
correctly when deployed to **Vercel** — nothing resets between requests.

Every route here was tested end-to-end against a real Postgres database while building
this: login, category creation, product creation, checkout with stock deduction,
out-of-stock rejection, review submit/approve, and admin-route protection. All passed.

---

## 1. Get your free accounts (5 minutes)

**Database — Neon:**
1. Go to https://neon.tech → sign up free → create a project.
2. Copy the connection string it gives you (looks like `postgresql://user:pass@host/dbname`).

**Image/video hosting — Cloudinary:**
1. Go to https://cloudinary.com/users/register/free → sign up free.
2. On your Dashboard, copy either the one-line `CLOUDINARY_URL`, or the three separate
   values (Cloud name, API Key, API Secret).

---

## 2. Run it locally

```bash
npm install
cp .env.example .env.local     # then paste your Neon + Cloudinary values into it
npm run migrate                 # creates all tables in your Postgres database
npm run seed                     # creates the first admin login
npm run dev                       # starts the site at http://localhost:3000
```

**Default admin login** (change this — see below):
- Username: `admin`
- Password: `admin123`

---

## 3. Deploy to Vercel (this is the point of this version)

1. Push this project to a GitHub repo.
2. Go to https://vercel.com → New Project → import that repo.
3. In the project's **Settings → Environment Variables**, add everything from
   `.env.example` with your real Neon + Cloudinary values (same names).
4. Deploy.
5. Once it's live, run the migration and seed **once** against your production
   database — easiest way is to run them from your own computer, pointed at the
   same `DATABASE_URL` you put in Vercel:
   ```bash
   DATABASE_URL="your-neon-connection-string" npm run migrate
   DATABASE_URL="your-neon-connection-string" npm run seed
   ```

That's it — your store, database, and every uploaded photo/video now persist properly,
because nothing is stored on Vercel's own filesystem anymore.

---

## 4. Changing the admin password

```bash
# stop the server, then, with DATABASE_URL pointed at the right database:
node -e "require('./lib/db').pool.query('DELETE FROM admins')"
SEED_ADMIN_USER=youruser SEED_ADMIN_PASS=yourstrongpassword npm run seed
```

---

## 5. What changed from the SQLite version

| Piece | Before (SQLite version) | Now |
|---|---|---|
| Database | Local file (`data/kaaya.db`) — lost on Vercel | Postgres via Neon — persists forever |
| Images/videos | Saved to `public/uploads/` — lost on Vercel | Uploaded straight to Cloudinary — persists forever, served from Cloudinary's CDN |
| Everything else | — | Identical: same admin panel, same storefront, same features |

`lib/db.js` now uses the `pg` package with parameterized queries and a real
transaction (`BEGIN`/`COMMIT`/`ROLLBACK` with row locking) for stock deduction during
checkout — this is what stops two customers from both buying the last item at once.

---

## 6. Project structure

```
schema.sql                      → run once via `npm run migrate` to create all tables
scripts/migrate.js                → applies schema.sql to DATABASE_URL
scripts/seed.js                    → creates the first admin account
lib/db.js                            → every database query (Postgres, async)
lib/auth.js                           → bcrypt password hashing + JWT sessions
lib/cloudinary.js                      → Cloudinary SDK configuration
app/api/upload/route.js                 → streams uploads directly to Cloudinary
app/page.js, app/admin/...                → same pages as before, now async
components/Storefront.js, AdminDashboard.js → same UI as before, unchanged
```

---

## 7. Still not included (same honest list as before)

- Real payment gateway (Cash on Delivery only, as requested)
- Customer-facing "track my order" page (orders are stored by phone number in the
  database and ready for this — just no page built for it yet)
- Email/SMS notifications on order status change
- Discount/coupon codes
- Deleting a product/category doesn't currently delete its Cloudinary images too
  (they just become unused in your Cloudinary account — harmless, but worth knowing)

# No Review Gate

A review and feedback campaign app for collecting star ratings and optional feedback from leads, then directing them to leave public reviews on Google or Yelp. Supports two campaign types: **Lead Docket** (identified by Lead ID) and **Filevine** (identified by Project ID).

## What it does

- **Public review page** (`/review`) — Customers open a link with `leadid` or `projectid` and `campaign` in the URL. They choose a 1–5 star rating; low ratings trigger an optional feedback form. After submitting, they see links to leave a review on Google and/or Yelp. No login required.
- **Admin dashboard** (`/admin`) — Create and manage campaigns (name, type, logo, colors, Google Place ID, Yelp link), enable/disable campaigns, copy shareable review links, and manage users (admin/user roles).
- **Reviews dashboard** (`/reviews`) — Any logged-in user can view all reviews with filters (campaign, rating, search) and sort. Admins can also open reviews for a single campaign from the admin dashboard (`/admin/reviews`).

**Tech:** React 19 + Vite 7, Tailwind CSS, Netlify serverless functions, Neon (PostgreSQL), JWT in HttpOnly cookies. Optional: Google Cloud Storage for campaign logos.

---

## Prerequisites

- **Node.js 18 or 20 LTS** (not Node 21+). Netlify CLI’s dependencies break on Node 21+ (e.g. `SlowBuffer` was removed). If you see `TypeError: Cannot read properties of undefined (reading 'prototype')`, switch to Node 20: `nvm use` (with the repo’s `.nvmrc`) or install Node 20 from [nodejs.org](https://nodejs.org).
- A [Neon](https://neon.tech) account (PostgreSQL)
- A [Netlify](https://netlify.com) account (for deploy and, optionally, Neon integration)
- For logo uploads: a Google Cloud project and GCS bucket (see [GCS_SETUP.md](./GCS_SETUP.md))

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd no-review-gate
npm install
```

### 2. Environment variables

Create a `.env` file in the project root (see [.gitignore](./.gitignore); `.env` is not committed).

**Required:**

| Variable | Description |
|----------|-------------|
| `NETLIFY_DATABASE_URL` | Neon PostgreSQL connection string (pooled). From Neon dashboard: Connection string, or from Netlify: Integrations → Neon → use provided URL. |
| `JWT_SECRET` | Secret used to sign JWT tokens. Use a long random string (e.g. `openssl rand -base64 32`). Do not use the default placeholder in production. |

**Optional (for campaign logos):**

| Variable | Description |
|----------|-------------|
| `GCS_SERVICE_ACCOUNT_KEY` | Full JSON key of the GCS service account (single line). |
| `GCS_PROJECT_ID` | Google Cloud project ID. |

Example `.env`:

```env
NETLIFY_DATABASE_URL=postgresql://user:password@host/db?sslmode=require
JWT_SECRET=your-secure-random-string

# Optional: logo uploads
# GCS_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# GCS_PROJECT_ID=your-gcp-project
```

For production on Netlify, set the same variables in **Site settings → Environment variables**. For GCS setup details, see [GCS_SETUP.md](./GCS_SETUP.md).

### 3. Database schema

1. In the [Neon](https://console.neon.tech) SQL editor, run the contents of:
   - `netlify/functions/setup-db.sql`
2. Then run any migrations you need (in order):
   - `netlify/functions/migrate-add-role.sql`
   - `netlify/functions/migrate-add-enabled-field.sql`
   - `netlify/functions/migrate-add-design-fields.sql`
   - `netlify/functions/migrate-add-campaign-type-and-project-id.sql`
   - `netlify/functions/migrate-add-agent-field.sql`

This creates `campaigns`, `users`, and `reviews` (and optional columns like `enabled`, `campaign_type`, `project_id`).

### 4. Create an admin user

With `NETLIFY_DATABASE_URL` and `JWT_SECRET` set (e.g. in `.env`), run:

```bash
npm run db:create-admin
```

By default this creates:

- Email: `alberto@calljacob.com`
- Password: `123456`

Change this password after first login. To create a different admin, edit `scripts/create-admin-user.js` and run the same command (or add users later from the admin dashboard).

### 5. Run locally

```bash
npm run dev
```

This runs `netlify dev`: Vite dev server plus Netlify functions with your `.env` (and Netlify-linked env). Open the URL shown (e.g. http://localhost:8888).

- **Login:** `/login` → use the admin email/password → redirects to `/admin`.
- **Review link (example):**  
  `http://localhost:8888/review?leadid=12345&agent=Jane%20Doe&campaign=1` (Lead Docket) or  
  `http://localhost:8888/review?projectid=abc&campaign=1` (Filevine).  
  Create a campaign in the admin first so `campaign=1` (or the campaign id) exists.

Other commands:

- `npm run build` — production build (output in `dist/`).
- `npm run db:setup` — run database setup script (see `scripts/setup-database.js`).
- `npm run db:migrate-role` — run role migration (see `scripts/migrate-add-role.js`).

---

## Deploying to Netlify

1. Connect the repo to Netlify (build command: `npm run build`, publish directory: `dist`).
2. Set environment variables in **Site settings → Environment variables**: at least `NETLIFY_DATABASE_URL` and `JWT_SECRET`; optionally GCS variables.
3. If you use Netlify’s Neon integration, `NETLIFY_DATABASE_URL` may be set automatically; otherwise paste your Neon connection string.
4. Deploy. The `netlify.toml` redirects already map `/api/*` to the serverless functions.

---

## Routes

| Path | Who | Purpose |
|------|-----|---------|
| `/review` | Public | Review form; requires `?leadid=…` or `?projectid=…` and `?campaign=…` |
| `/login` | Public | Admin login |
| `/admin` | Admin only | Campaigns and user management |
| `/admin/reviews` | Admin only | Reviews for one campaign |
| `/reviews` | Logged-in users | All reviews, filters and sort |
| `/` | Redirect | Sends to `/reviews` |

---

## More detail

- **Database and API:** [README-DATABASE.md](./README-DATABASE.md) — schema, auth, API endpoints.
- **Logo storage (GCS):** [GCS_SETUP.md](./GCS_SETUP.md) — bucket, service account, env vars, troubleshooting.
- **Image storage options:** [IMAGE_STORAGE_OPTIONS.md](./IMAGE_STORAGE_OPTIONS.md) — alternatives to GCS.

# Deployment & setup

## Run locally (default — no backend needed)

```bash
cd focal-rps
npm install
npm run dev        # http://localhost:5173
```

The app runs against **IndexedDB** (Dexie) and seeds removable demo data on first
launch. `npm run test` runs the engine unit tests; `npm run build` produces a
static bundle in `apps/web/dist`.

## Switch to Supabase (multi-user, realtime, server-enforced permissions)

1. **Create a project** at supabase.com → note the Project URL and the `anon`
   public key (Project Settings → API).
2. **Create the schema.** In the Supabase SQL editor, run in order:
   - `supabase/schema.sql` (tables, indexes, views, triggers)
   - `supabase/policies.sql` (Row-Level Security)
   - `supabase/seed.sql` (reference data + default settings)
3. **Configure the app.** In `apps/web`, copy `.env.example` → `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   On next start the app auto-selects `SupabaseDataProvider` (see
   `src/data/index.ts`). No code changes required.
4. **Auth (email + password, verified, @focalpm.com only).** In Supabase →
   Authentication → Providers, ensure **Email** is enabled with **"Confirm email" ON**
   (so new sign-ups must verify). Under **URL Configuration**, add your app URLs to
   **Redirect URLs** (e.g. `http://localhost:5173`, and the GitHub Pages URL) so
   verification/reset links return to the app. When env keys are set, the app shows
   the **Login / Sign up / Forgot-password** screen; on sign-in it reads the user's
   `app_users` row and that role drives the whole UI.
   - **Domain lock:** `enforce_email_domain` (a `before insert` trigger on
     `auth.users`) rejects any address that isn't `@focalpm.com`. Change the domain
     there if needed. The signup form also validates this client-side.
   - **Auto-provision + auto-link:** `handle_new_user` creates a `staff` `app_users`
     row on first signup AND links it to a Person (`resources` row) whose `email`
     matches — so "create the Person first, they sign up later" connects automatically.
   - **Account already exists:** the signup form detects this and steers the user to
     **Sign in** / **Forgot password**.
   - **Bootstrap the first Master Admin** (one-time, after that person signs up &
     verifies — you can also confirm them manually in Authentication → Users):
     ```sql
     update app_users set role = 'master_admin' where email = 'me@focalpm.com';
     ```
   - Everyone else is managed in-app: **Admin → Users** (promote to Admin, deactivate,
     link to a resource). A trigger keeps ≥1 active Master Admin. **Never** put the
     `service_role` key in the frontend — only the `anon` key.
5. **Realtime** is already enabled by `schema.sql` (the tables are added to the
   `supabase_realtime` publication), so edits propagate to other signed-in users
   live — no extra setup.
6. **Migrate existing data.** Sign in as the Master Admin, then use
   **Reports → Import live workbook** to load the `Focal Resource Forecast`
   workbook (or run SQL inserts).

## Hosting

- **Frontend:** deploy `apps/web` to Vercel or Netlify (framework: Vite). Set the
  two `VITE_SUPABASE_*` env vars in the host's dashboard.
- **Data:** Supabase (managed Postgres + Auth + Storage + realtime).
- Local IndexedDB mode also deploys as a pure static site (no backend), useful
  for a single-user pilot.

## Notes

- The production bundle is ~360 kB gzip (xlsx + chart.js + supabase). Acceptable
  for an internal tool; can be code-split later if needed.
- `prefers-reduced-motion` and keyboard navigation on grids/modals are respected.

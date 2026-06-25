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
4. **Auth & roles.** Enable an auth provider (email/password is simplest) in
   Supabase. For each person who signs in, insert an `app_users` row keyed by
   their auth UID with the right role (`master_admin` | `admin` | `staff`):
   ```sql
   insert into app_users (id, email, name, role)
   values ('<auth-uid>', 'me@focalpm.com', 'Owner', 'master_admin');
   ```
   RLS reads this row to authorize writes. The first **Master Admin** is added via
   the SQL editor; afterwards they manage everyone in **Admin → Users** (promote to
   Admin, deactivate, link Staff to a resource). A trigger keeps at least one active
   Master Admin at all times.
5. **Migrate existing data.** Use **Reports → Import live workbook** to load the
   `Focal Resource Forecast` workbook, or run your own SQL inserts.

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

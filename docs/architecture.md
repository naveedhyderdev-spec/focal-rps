# Architecture

The FOCAL Resource Planning System is a single-page web app over a **swappable
data layer**. Every screen talks to a `DataProvider` interface — never to a
database directly — so the persistence backend can change with zero UI rewrites.

## Layers

```
┌───────────────────────────────────────────────────────────┐
│ apps/web (React 18 + Vite + TypeScript)                    │
│   pages/         dashboard, projects, project-details,     │
│                  resources, board, summary, graphs,        │
│                  reports, admin, search                    │
│   components/    shell (sidebar/topbar), ui (DataTable,    │
│                  Modal, Field…), charts, board, admin      │
│   hooks/         useData (TanStack Query + permissions +   │
│                  activity log), useReference, useDerived    │
│   lib/           format, board, projects, charts, excel,   │
│                  importer, permissions, naming, queryClient │
│   store/         appStore (Zustand: sidebar, role, persona, │
│                  toasts)                                     │
│   data/          provider (interface) · localProvider      │
│                  (IndexedDB/Dexie) · supabaseProvider       │
│                  (PostgreSQL) · seed (demo data)            │
│   styles/        tokens (Focal dark) · base · components    │
├───────────────────────────────────────────────────────────┤
│ packages/engine (framework-agnostic, unit-tested)          │
│   dates · capacity · bands · utilization · demand ·         │
│   conflicts · types                                         │
├───────────────────────────────────────────────────────────┤
│ Persistence (selected at runtime by env)                   │
│   Local:    IndexedDB via Dexie (default, offline)         │
│   Supabase: PostgreSQL + Auth + RLS + realtime             │
└───────────────────────────────────────────────────────────┘
```

## Key decisions

- **Swappable data layer.** `data/provider.ts` defines the contract (`Repo<T>`,
  `AllocationRepo`, settings, demo-data ops). `LocalDataProvider` (Dexie) is the
  default; `SupabaseDataProvider` is selected automatically when
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set (`data/index.ts`).
- **The engine is the single source of truth for math** (§3 of the brief):
  the 42.5h capacity rule, utilization (sum of factors), colour bands,
  demand/capacity and conflict detection. It is pure and unit-tested (Vitest),
  so the numbers are identical on every screen and on the server views.
- **Permissions are enforced in the mutation layer** (`hooks/useData.ts` →
  `lib/permissions.ts`) and mirrored by Supabase **Row-Level Security**. The UI
  also hides actions a role can't perform (defence in depth).
- **State:** server/domain data via **TanStack Query** (cache + invalidation);
  light client state (sidebar, current role, persona, toasts) via **Zustand**.
- **Design system:** Focal dark brand tokens in `styles/tokens.css`
  (semantic names kept stable so components are theme-agnostic). Poppins +
  Montserrat; Chart.js for sleek minimal charts.

## Data flow (a write)

1. A page calls a mutation hook (e.g. `resourcesH.useCreate()`).
2. The hook runs `enforce(capability)` (role check), then `provider.<entity>.create()`.
3. It writes an `activity_log` entry, then invalidates the relevant query keys.
4. TanStack Query refetches; every dependent view (board, summary, dashboard,
   graphs) recomputes via the engine from the new data.

With Supabase, realtime subscriptions can additionally push other users'
changes; RLS guarantees a Viewer's write is rejected server-side regardless of UI.

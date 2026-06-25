# FOCAL Resource Planning System

A centralized, multi-user web app that replaces FOCAL Project Management's Excel-based
resource forecasting workbook. Built per the Master Build Prompt — fully data-driven,
Admin-managed, with a Primavera-P6-style allocation board, weekly utilization, and
demand-vs-capacity insights.

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript
- **Engine:** `@focal/engine` — a framework-agnostic capacity/utilization calc module (unit-tested with Vitest)
- **State / data fetching:** TanStack Query + Zustand
- **Data layer:** a swappable async `DataProvider` interface. Today it's backed by **IndexedDB (Dexie)**
  for a local-first build; a `SupabaseDataProvider` will drop in later with no UI changes.
- **Charts:** Chart.js · **Icons:** Tabler · **Font:** Inter · **Excel:** SheetJS

## Monorepo layout

```
focal-rps/
├─ apps/web/                 # frontend (pages, components, data layer, hooks, styles)
├─ packages/engine/          # capacity/utilization engine + tests
└─ supabase/                 # (M10) schema.sql, RLS policies, seed.sql
```

## Quick start

```bash
cd focal-rps
npm install
npm run dev        # → http://localhost:5173
```

On first launch the app seeds **removable demo data** (Admin → Reset / clear demo data wipes it).
The system works correctly from an empty database too.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app (Vite) |
| `npm run build` | Production build of the web app |
| `npm run test` | Run the engine unit tests (Vitest) |
| `npm run typecheck` | Type-check the web app |

## Calculation model (the important part)

- Weekly capacity = **42.5 h = 100%**. Allocations stored as a **factor** (e.g. `0.5` = 50% = 21.25 h);
  factors may exceed `1.0` and are **never silently clamped** — over-allocation stays visible.
- `utilization% = Σ(allocation_factor over all of a resource's allocations that week) × 100`.
- Utilization colour bands, over-allocation (>110%), and bench gaps (<50%) are all **configurable** in
  Admin → Settings.

## Build progress — V1 complete ✅

- **M1** Monorepo, engine (+20 tests), design system, app shell, data layer, demo seed
- **M2** People CRUD · **M3** Projects + Project Details + allocation editor + mini-Gantt
- **M4** Allocation Board (P6-style: heatmap, drag/resize, Day/Week/Month/Quarter, shading, conflict flags)
- **M5** Resource Summary (month→weeks expansion, Excel export) · **M6** Dashboard (charts, personas, sparklines)
- **M7** Insights (team/discipline demand vs capacity) · **M8** Admin (master-data editors + Settings)
- **M9** Global search, notifications centre, activity log, Excel export + live-workbook importer
- **M10** Dark Focal theme, Supabase wire-up (`supabase/` schema + RLS + provider), docs, acceptance pass

Theme: **Focal Middle East dark brand**. Default data layer: IndexedDB (local-first).
Set `VITE_SUPABASE_*` to switch to Postgres — see [docs/deployment.md](docs/deployment.md).

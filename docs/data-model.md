# Data model

Canonical types live in `packages/engine/src/types.ts`; the PostgreSQL schema in
`supabase/schema.sql` mirrors them. Everything is **CRUD-managed at runtime** —
no entity is fixed.

## Entities

| Table | Purpose | Key fields |
|---|---|---|
| `locations` | Offices | code (COK/DXB/SRI/BLR), name, is_active |
| `disciplines` | Engineering disciplines | name, **color**, sort_order, is_active |
| `grades` | Seniority/role grades | name, discipline_category, sort_order |
| `teams` | Delivery teams | name, is_active |
| `stage_types` | Master stage names | name, sort_order, is_active |
| `holidays` | Public holidays | date, name, **location_id (null = all)** |
| `settings` | App config (key/value) | `app_settings` JSON blob |
| `resources` | People | forename, **full_name**, discipline/grade/team/location ids, employment_type, weekly_capacity_hours (42.5), status |
| `projects` | Programmes | code, name, client, location, PM, type, status |
| `project_stages` | Stages within a project | stage_name, start/end, duration_weeks |
| `allocations` | **The grid** | resource_id, project_id, stage_id?, week_start_date, allocation_factor |
| `look_ahead` | Weekly look-ahead tracker | task, lead, status, complete_pct |
| `activity_log` | Audit | user_id, action, entity, details |
| `app_users` | Auth ↔ role map | email, name, role (Admin/Planner/Viewer) |

## The allocation grid

Allocations are stored **one row per (resource, project, stage?, week)**. This
normalization is what makes utilization a simple `SUM`:

```
utilization%(resource, week) = ( Σ allocation_factor for that resource that week ) × 100
```

`allocation_factor` is a decimal multiplier of weekly capacity: `1.00` = 100% =
42.5h. Factors **may exceed 1.00** (over-allocation) and are never clamped.

## Derived views (server-side aggregation)

- `v_weekly_utilization` — per resource per week: summed factor + util%.
- `v_discipline_demand_weekly` — per discipline per week: demand h vs capacity h.
- `v_team_demand_weekly` — same, by team.

These reproduce what `packages/engine` computes client-side, so heavy aggregation
can move to the database at scale.

## Status semantics

- Resource `status` ∈ Active · On Leave · Future Joiner · Resigned · Inactive.
  **Resigned/Inactive** are excluded from allocation dropdowns but keep history.
- Project `status` ∈ Active · On Hold · Archived. Archived projects drop out of
  pickers and most rollups but are retained.

## Settings (`app_settings`)

`weekly_capacity_hours` (42.5), `week_start_day` (6 = Saturday),
`util_thresholds` (under/moderate/full/slightOver maxima), `planner_start`,
`horizon_months`, `bench_threshold`, `overalloc_threshold`, `version`.
All editable in **Admin → Settings**; the colour bands and warnings key off them.

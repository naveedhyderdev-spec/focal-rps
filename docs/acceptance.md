# V1 acceptance criteria (§16)

Status legend: ✅ done & verified · ◑ implemented, full effect needs the Supabase
connection (multi-user/realtime/server-side enforcement).

| # | Criterion | Status | Where / evidence |
|---|---|---|---|
| 1 | Admin adds a project with stages, adds an employee, allocates at a weekly %, and it persists (for other users in real time) | ✅ / ◑ | Projects + Project Details + People + Allocation editor; persisted via the data layer and verified end-to-end. Real-time multi-user sync activates on the Supabase provider. |
| 2 | Changing an allocation's % updates weekly hours by the 42.5 rule (and vice-versa) everywhere | ✅ | `packages/engine` capacity module (unit-tested); editors show 50% → 21.25h live; hours derive from factor everywhere. |
| 3 | A resource on multiple projects shows **summed** utilization, colour-banded, on Board/Summary/Dashboard | ✅ | Verified: e.g. 50%+70% = 120% renders red with a conflict flag across all three views. |
| 4 | Allocation Board: Day/Week/Month/Quarter, drag-create/move/resize, inline %/hours edit, weekend-grey + holiday-pink, flags >110% | ✅ | Board verified across views; drag-create + bar-click edit tested; weekend shading shown; >110% flagged. |
| 5 | Resource Summary: weekly util, multi-select **month filter that expands into weeks**, five filters, average column | ✅ | Verified — toggling a month changed the visible weeks (31 ↔ 35); Avg column colour-banded. |
| 6 | Graphs: demand vs an always-visible **dashed capacity line**, by team and by discipline | ✅ | Insights tabs verified. On the dark theme the capacity reference is a **light** dashed line (the spec's "black" would be invisible on black). |
| 7 | Permissions enforced server-side: Viewer can't edit, Planner can't reach Admin/delete, only Admin manages master data | ✅ / ◑ | UI gating verified (Admin nav hides for Viewer); mutation layer runs `enforce()`. Server-side enforcement = `supabase/policies.sql` (RLS) when connected. |
| 8 | Excel import reproduces the live workbook's numbers (validation passes); Excel export works | ✅ / ◑ | Export verified (3 reports). Importer parser verified against the real workbook (30 people, 7 projects, 37 stages, 944 allocations) with a dry-run + structural validation. Full Summary/Team-Wise cell-by-cell reconciliation is a follow-up. |
| 9 | Inactive/Resigned never appear in allocation dropdowns (history kept); app runs from an **empty database**; Reset clears demo data | ✅ | `ALLOCATABLE_EXCLUDED_STATUSES` filter in editors/board; empty states throughout; Admin → Reset/Wipe verified. |
| 10 | Global search, notifications (3 warning types), activity log, responsive tablet layout | ✅ | Search verified; notification centre shows over-allocations/gaps/project-conflicts and navigates; activity log writes on every mutation; responsive breakpoints at 1024/768px. |

## Verified in-browser during the build
Dashboard KPIs & charts · People CRUD (create/delete) · Projects CRUD + stage
builder · Project Details + allocation add/remove · Allocation Board heatmap,
expand, drag-create, bar-edit, Day-view shading · Resource Summary month→weeks +
Excel export · Insights team/discipline charts · Admin Settings + master-data
CRUD · global search · Reports exports · importer parser (Node, real file).

## RBAC change prompt — acceptance (§7)
The roles model was replaced with **Master Admin → Admin → Staff** (the old §5
Admin/Planner/Viewer; "Planner" folded into Admin).

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Three roles with the §3 matrix enforced server-side | ✅ / ◑ | `lib/permissions.ts` matrix + mutation `enforce()`; mirrored by `supabase/policies.sql` RLS (active on connect). |
| 2 | Master Admin promotes/demotes, multiple Admins allowed | ✅ | Admin → Users (User Management): Promote/Demote + role edit; guard keeps ≥1 Master. |
| 3 | Admin does ops but can't see user-mgmt / protected settings | ✅ | Verified: Admin's Admin page shows only master-data + demo tabs (no Settings/Users); "Admin Dashboard", no User Management button. |
| 4 | Staff lands on "My Allocation" with per-project %/hours + totals; browses read-only; never sees master/admin dashboard | ✅ | Verified: `/me` landing, per-project breakdown (e.g. 50%+50% = 100%, 21.25h each); nav scoped to My Allocation/Projects/Board/Summary/Insights. |
| 5 | Forbidden nav/controls hidden; forbidden API rejected for Staff/Admin | ✅ / ◑ | Nav + action buttons hidden per role; mutation layer + RLS reject writes. |
| 6 | ≥1 Master Admin always; role changes logged | ✅ | `UserManagement` guard + Postgres `guard_last_master` trigger; role edits write to `activity_log`. |

## Engine tests
`npm run test` → 20 passing unit tests covering dates/weeks, the 42.5 capacity
rule, colour bands, summed utilization, demand-vs-capacity, and conflict rules.

# User guide

## Roles (three-tier hierarchy)

**Master Admin → Admin → Staff.** Each role lands on a tailored view, and the UI
hides what a role can't use.

| Capability | Master Admin | Admin | Staff |
|---|:--:|:--:|:--:|
| Appoint/remove Admins, manage user accounts & roles | ✅ | ❌ | ❌ |
| Protected system settings (capacity, thresholds, week-start) | ✅ | ❌ | ❌ |
| Manage master data (teams/disciplines/grades/locations/stages/holidays) | ✅ | ✅\* | ❌ |
| Create / edit / archive projects + stages | ✅ | ✅ | ❌ |
| Add / edit / deactivate employees | ✅ | ✅ | ❌ |
| Create / modify / move / delete allocations | ✅ | ✅ | ❌ |
| Export reports (Excel) | ✅ | ✅ | ❌ |
| View dashboards / summary / board / graphs | ✅ | ✅ | ✅ (read-only) |
| View **own** allocation ("My Allocation") | ✅ | ✅ | ✅ |

\* *Admins can edit master data only when the "Admins can edit master data" toggle
is on (Admin → Settings → Access). Master-Admin-only restrictions always hold.*

**Landing views:** Master Admin → **Master Dashboard** (+ User Management);
Admin → **Admin Dashboard** (operational); Staff → **My Allocation** (their own
per-project breakdown, then read-only browse). Switch the active role for testing
from the **account menu** (top-right) — it adopts a representative seeded account.
With Supabase, your role comes from your `app_users` record (linked to your auth UID).

### My Allocation (all roles, the Staff landing page)
Shows your weekly utilization with colour bands, a **per-project breakdown**
(each project's %, average weekly hours and peak), and your combined weekly total,
plus read-only links to browse the team-wide views. Master/Admin can pick any
person via "Viewing as".

## Pages

- **Command Centre (Dashboard)** — KPIs (projects, people, current utilization,
  over-allocated, gaps), top over-allocated people with sparklines, active
  warnings, recent activity, and demand-vs-capacity. Use the **persona presets**
  (Resource Manager / Executive / PM / Discipline Lead) to re-scope the view.
- **Projects** — grid with search/filters; add/edit/archive/delete. Opening a
  project shows its **stages**, **assigned resources**, and a mini-Gantt. Add a
  resource to set a flat % across a date range (hours auto-calculate).
- **People** — manage engineers, leads and support staff. Inactive/Resigned
  people are hidden from allocation pickers but keep their history.
- **Allocation Board** — the planning grid. Resources are grouped by
  Team → Discipline; each cell is coloured by that week's total utilization.
  Switch **Day / Week / Month / Quarter**, jump to **Today**, and (in Week view)
  expand a person to **drag, resize or add** allocation bars; click a bar to edit
  its % (weekly hours stay in sync via the 42.5 rule). Weekends are grey, public
  holidays pink, and any week over 110% is flagged red.
- **Resource Summary** — weekly utilization matrix. Pick months in the **Month**
  filter and they expand into their weeks. Export to Excel.
- **Insights** — Team and Discipline loading: weekly demand vs the dashed
  capacity line, with avg/peak utilization per group.
- **Reports** — one-click Excel exports (Summary, Allocations, Capacity) and the
  **live-workbook importer** (dry-run preview before committing).
- **Admin** — Settings (capacity, week-start, utilization thresholds, planner
  start) and master-data editors (Teams, Disciplines, Grades, Locations, Stages,
  Holidays, Users). The **Reset / clear demo data** action wipes placeholder
  rows, leaving a clean instance.

## Utilization colour bands

| Band | Range | Meaning |
|---|---|---|
| Blue | 0–79% | Under-utilized |
| Lavender | 80–90% | Moderately utilized |
| Green | 91–100% | Fully utilized |
| Orange | 101–110% | Slightly over |
| Red | > 110% | Over-allocated (flagged) |

Thresholds are editable in **Admin → Settings**.

## Tips

- The top-bar search finds projects, people and stages — press Enter to see
  grouped results.
- The bell shows live warnings (over-allocations, gaps, unstaffed/out-of-range
  project stages); click one to jump to the board or the project.

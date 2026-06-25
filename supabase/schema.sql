-- ============================================================
-- FOCAL Resource Planning System — PostgreSQL schema (Supabase)
-- Mirrors the DataProvider interface the app codes against, so the
-- SupabaseDataProvider drops in with no UI changes (spec §6).
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ── auto-update updated_at ──
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ── Reference / master data ──────────────────────────────────
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true
);

create table if not exists disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'var(--disc-mech)',
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discipline_category text,
  sort_order int not null default 0
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true
);

create table if not exists stage_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references locations(id) on delete set null,  -- null = all locations
  date date not null,
  name text not null
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

-- ── People ───────────────────────────────────────────────────
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  forename text not null,
  full_name text not null,
  discipline_id uuid references disciplines(id) on delete set null,
  grade_id uuid references grades(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  employment_type text not null default 'In House',
  employee_code text,
  role_title text,
  weekly_capacity_hours numeric not null default 42.5,
  status text not null default 'Active',
  join_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_resources_team on resources(team_id);
create index if not exists idx_resources_discipline on resources(discipline_id);
create index if not exists idx_resources_status on resources(status);

-- ── Projects & stages ────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  code text not null default '',
  name text not null,
  client text,
  location_id uuid references locations(id) on delete set null,
  project_manager text,
  project_type text,
  status text not null default 'Active',
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_type_id uuid references stage_types(id) on delete set null,
  stage_name text not null,
  start_date date not null,
  end_date date not null,
  duration_weeks int not null default 1,
  sort_order int not null default 0
);
create index if not exists idx_stages_project on project_stages(project_id);

-- ── The time-phased allocation grid (heart of the system) ─────
create table if not exists allocations (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  stage_id uuid references project_stages(id) on delete set null,
  week_start_date date not null,
  allocation_factor numeric(4,2) not null default 0,  -- 1.00 = 100% = capacity; may exceed 1.00
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one row per (resource, project, stage, week); treats null stage as a fixed sentinel so it dedupes
create unique index if not exists uq_alloc on allocations
  (resource_id, project_id, coalesce(stage_id, '00000000-0000-0000-0000-000000000000'::uuid), week_start_date);
create index if not exists idx_alloc_resource_week on allocations(resource_id, week_start_date);
create index if not exists idx_alloc_project on allocations(project_id);

-- ── Look-ahead, audit, users ─────────────────────────────────
create table if not exists look_ahead (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task text not null,
  project_lead text,
  status text,
  priority text,
  complete_pct numeric,
  remarks text,
  week_start_date date,
  sort_order int not null default 0
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_created on activity_log(created_at desc);

-- App users map 1:1 to auth.users (id = auth uid). Three-tier RBAC.
create table if not exists app_users (
  id uuid primary key,
  email text not null,
  name text not null,
  role text not null default 'staff',   -- master_admin | admin | staff
  status text not null default 'Active',
  resource_id uuid references resources(id) on delete set null  -- links a Staff account to its person
);

-- ── updated_at triggers ──
drop trigger if exists trg_resources_updated on resources;
create trigger trg_resources_updated before update on resources for each row execute function set_updated_at();
drop trigger if exists trg_projects_updated on projects;
create trigger trg_projects_updated before update on projects for each row execute function set_updated_at();
drop trigger if exists trg_alloc_updated on allocations;
create trigger trg_alloc_updated before update on allocations for each row execute function set_updated_at();

-- ============================================================
-- Derived views (spec §6) — server-side aggregation helpers.
-- The app can use these instead of computing client-side at scale.
-- ============================================================

-- Per resource per week: summed factor and util%.
create or replace view v_weekly_utilization as
select
  a.resource_id,
  r.full_name,
  r.team_id, r.discipline_id, r.grade_id, r.location_id,
  a.week_start_date,
  sum(a.allocation_factor)              as total_factor,
  round(sum(a.allocation_factor) * 100) as util_pct
from allocations a
join resources r on r.id = a.resource_id
group by a.resource_id, r.full_name, r.team_id, r.discipline_id, r.grade_id, r.location_id, a.week_start_date;

-- Per discipline per week: demand hours vs capacity hours.
create or replace view v_discipline_demand_weekly as
with cap as (
  select discipline_id, count(*)::numeric * 42.5 as capacity_hours
  from resources where status = 'Active' and discipline_id is not null
  group by discipline_id
),
dem as (
  select r.discipline_id, a.week_start_date, sum(a.allocation_factor) * 42.5 as demand_hours
  from allocations a join resources r on r.id = a.resource_id
  where r.discipline_id is not null
  group by r.discipline_id, a.week_start_date
)
select dem.discipline_id, d.name as discipline_name, dem.week_start_date,
       dem.demand_hours, coalesce(cap.capacity_hours, 0) as capacity_hours
from dem
join disciplines d on d.id = dem.discipline_id
left join cap on cap.discipline_id = dem.discipline_id;

-- Per team per week: demand hours vs capacity hours.
create or replace view v_team_demand_weekly as
with cap as (
  select team_id, count(*)::numeric * 42.5 as capacity_hours
  from resources where status = 'Active' and team_id is not null
  group by team_id
),
dem as (
  select r.team_id, a.week_start_date, sum(a.allocation_factor) * 42.5 as demand_hours
  from allocations a join resources r on r.id = a.resource_id
  where r.team_id is not null
  group by r.team_id, a.week_start_date
)
select dem.team_id, t.name as team_name, dem.week_start_date,
       dem.demand_hours, coalesce(cap.capacity_hours, 0) as capacity_hours
from dem
join teams t on t.id = dem.team_id
left join cap on cap.team_id = dem.team_id;

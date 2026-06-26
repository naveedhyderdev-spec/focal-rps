-- ============================================================
-- FOCAL RPS — de-duplicate master data
-- Demo data loaded more than once can leave duplicate disciplines/teams/etc.
-- (two "BIM", two "COK" …), which broke the employee load with
-- "more than one row returned by a subquery used as an expression".
--
-- This keeps ONE row per natural key (lowest id), re-points every reference
-- to the kept row, then deletes the extras. Idempotent + safe to re-run
-- (no-op once there are no duplicates). Run this, THEN seed_india_employees.sql.
-- ============================================================

-- ── Locations (key = code) — referenced by resources, projects, holidays ──
update resources r set location_id = k.keep_id
  from (select code, min(id::text)::uuid keep_id from locations group by code) k
  join locations d on d.code = k.code and d.id <> k.keep_id
  where r.location_id = d.id;
update projects p set location_id = k.keep_id
  from (select code, min(id::text)::uuid keep_id from locations group by code) k
  join locations d on d.code = k.code and d.id <> k.keep_id
  where p.location_id = d.id;
update holidays h set location_id = k.keep_id
  from (select code, min(id::text)::uuid keep_id from locations group by code) k
  join locations d on d.code = k.code and d.id <> k.keep_id
  where h.location_id = d.id;
delete from locations d using (select code, min(id::text)::uuid keep_id from locations group by code) k
  where d.code = k.code and d.id <> k.keep_id;

-- ── Disciplines (key = name) — referenced by resources ──
update resources r set discipline_id = k.keep_id
  from (select name, min(id::text)::uuid keep_id from disciplines group by name) k
  join disciplines d on d.name = k.name and d.id <> k.keep_id
  where r.discipline_id = d.id;
delete from disciplines d using (select name, min(id::text)::uuid keep_id from disciplines group by name) k
  where d.name = k.name and d.id <> k.keep_id;

-- ── Grades (key = name) — referenced by resources ──
update resources r set grade_id = k.keep_id
  from (select name, min(id::text)::uuid keep_id from grades group by name) k
  join grades d on d.name = k.name and d.id <> k.keep_id
  where r.grade_id = d.id;
delete from grades d using (select name, min(id::text)::uuid keep_id from grades group by name) k
  where d.name = k.name and d.id <> k.keep_id;

-- ── Teams (key = name) — referenced by resources ──
update resources r set team_id = k.keep_id
  from (select name, min(id::text)::uuid keep_id from teams group by name) k
  join teams d on d.name = k.name and d.id <> k.keep_id
  where r.team_id = d.id;
delete from teams d using (select name, min(id::text)::uuid keep_id from teams group by name) k
  where d.name = k.name and d.id <> k.keep_id;

-- ── Stage types (key = name) — referenced by project_stages ──
update project_stages s set stage_type_id = k.keep_id
  from (select name, min(id::text)::uuid keep_id from stage_types group by name) k
  join stage_types d on d.name = k.name and d.id <> k.keep_id
  where s.stage_type_id = d.id;
delete from stage_types d using (select name, min(id::text)::uuid keep_id from stage_types group by name) k
  where d.name = k.name and d.id <> k.keep_id;

-- ── Project types (key = name) — no FK (projects.project_type is text) ──
delete from project_types d using (select name, min(id::text)::uuid keep_id from project_types group by name) k
  where d.name = k.name and d.id <> k.keep_id;

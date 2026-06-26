-- ============================================================
-- FOCAL RPS — Row-Level Security (RBAC: Master Admin → Admin → Staff)
-- Enforced server-side; the UI additionally hides what a role can't use.
--   Staff ............ read-only everywhere (incl. own "My Allocation")
--   Admin ............ + write projects / people / allocations / master data
--   Master Admin ..... + manage users & roles + protected settings
-- Run AFTER schema.sql.
-- ============================================================

create or replace function app_role() returns text as $$
  select coalesce((select role from app_users where id = auth.uid()), 'staff');
$$ language sql stable security definer;

create or replace function is_master() returns boolean as $$ select app_role() = 'master_admin'; $$ language sql stable;
-- Operational write tier (projects/people/allocations/master data): Master + Admin.
create or replace function can_admin() returns boolean as $$ select app_role() in ('master_admin','admin'); $$ language sql stable;

-- Enable RLS everywhere
alter table locations       enable row level security;
alter table disciplines     enable row level security;
alter table grades          enable row level security;
alter table teams           enable row level security;
alter table stage_types     enable row level security;
alter table project_types   enable row level security;
alter table holidays        enable row level security;
alter table settings        enable row level security;
alter table resources       enable row level security;
alter table projects        enable row level security;
alter table project_stages  enable row level security;
alter table allocations     enable row level security;
alter table look_ahead      enable row level security;
alter table activity_log    enable row level security;
alter table app_users       enable row level security;

-- Everyone authenticated can READ (Staff browse the whole picture read-only)
do $$
declare t text;
begin
  foreach t in array array['locations','disciplines','grades','teams','stage_types','project_types','holidays',
      'settings','resources','projects','project_stages','allocations','look_ahead','activity_log','app_users']
  loop
    execute format('drop policy if exists "read_all" on %I;', t);
    execute format('create policy "read_all" on %I for select to authenticated using (true);', t);
  end loop;
end $$;

-- Operational write (Master + Admin): master data, resources, projects, stages, allocations, look-ahead
do $$
declare t text;
begin
  foreach t in array array['locations','disciplines','grades','teams','stage_types','project_types','holidays',
      'resources','projects','project_stages','allocations','look_ahead']
  loop
    execute format('drop policy if exists "admin_write" on %I;', t);
    execute format('create policy "admin_write" on %I for all to authenticated using (can_admin()) with check (can_admin());', t);
  end loop;
end $$;

-- Protected settings: Master Admin only
drop policy if exists "master_settings" on settings;
create policy "master_settings" on settings for all to authenticated using (is_master()) with check (is_master());

-- User accounts & roles: Master Admin only (no privilege self-escalation by Admins)
drop policy if exists "master_users" on app_users;
create policy "master_users" on app_users for all to authenticated using (is_master()) with check (is_master());

-- Activity log: any authenticated user may append (writes are audited regardless of role)
drop policy if exists "append_activity" on activity_log;
create policy "append_activity" on activity_log for insert to authenticated with check (true);

-- ── Guard rail: always keep at least one active Master Admin ──
create or replace function guard_last_master() returns trigger as $$
begin
  if (tg_op = 'DELETE' or new.role <> 'master_admin' or new.status <> 'Active') then
    if (select count(*) from app_users where role = 'master_admin' and status = 'Active'
          and id <> old.id) = 0
       and old.role = 'master_admin' and old.status = 'Active' then
      raise exception 'At least one active Master Admin must remain';
    end if;
  end if;
  -- A BEFORE DELETE trigger must return OLD (NEW is null on delete; returning it
  -- silently cancels the delete). UPDATE/INSERT return NEW.
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_guard_master_update on app_users;
create trigger trg_guard_master_update before update on app_users for each row execute function guard_last_master();
drop trigger if exists trg_guard_master_delete on app_users;
create trigger trg_guard_master_delete before delete on app_users for each row execute function guard_last_master();

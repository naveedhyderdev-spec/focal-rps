-- ============================================================
-- FOCAL RPS — reference data seed (run AFTER schema.sql).
-- Seeds the canonical master lists + default settings. People,
-- projects and allocations are loaded in-app (importer / "Load
-- demo data"), so this leaves a clean, production-ready instance.
-- ============================================================

insert into locations (code, name) values
  ('COK','Cochin, India'), ('DXB','Dubai, UAE'), ('SRI','Sri Lanka'), ('BLR','Bangalore, India')
on conflict do nothing;

insert into disciplines (name, color, sort_order) values
  ('Mechanical','var(--disc-mech)',1),
  ('Electrical','var(--disc-elec)',2),
  ('Public Health','var(--disc-plumb)',3),
  ('BIM','var(--disc-bim)',4)
on conflict do nothing;

insert into teams (name) values
  ('Team A'), ('Team B'), ('Team C'), ('Team D'), ('Shared Support')
on conflict do nothing;

insert into grades (name, discipline_category, sort_order) values
  ('Manager',null,0), ('Associate',null,1),
  ('Principal Engineer (M)','M',2), ('Senior Engineer (M)','M',3), ('Engineer (M)','M',4),
  ('Principal Engineer (E)','E',5), ('Senior Engineer (E)','E',6), ('Engineer (E)','E',7),
  ('Engineer PHE','PH',8), ('Engineer (GET)','GET',9)
on conflict do nothing;

insert into stage_types (name, sort_order) values
  ('CD',0), ('SD 50%',1), ('SD 100%',2), ('DD 50%',3), ('DD 100%',4),
  ('AOR',5), ('TD/IFC',6), ('Tender Review',7), ('IFC',8)
on conflict do nothing;

insert into settings (key, value) values
  ('app_settings', jsonb_build_object(
    'weekly_capacity_hours', 42.5,
    'week_start_day', 6,
    'util_thresholds', jsonb_build_object('underMax',79,'moderateMax',90,'fullMax',100,'slightOverMax',110),
    'planner_start', '2025-06-07',
    'horizon_months', 24,
    'bench_threshold', 50,
    'overalloc_threshold', 110,
    'master_data_admin_editable', true,
    'version', '1.0.0'
  ))
on conflict (key) do nothing;

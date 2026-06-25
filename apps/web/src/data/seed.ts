/**
 * Removable demo data (spec §8) — illustrative sample data for first-load
 * visuals only. NOT a source of truth and nothing is hard-coded from it in app
 * logic. Loaded behind the Admin "Reset / clear demo data" action.
 */

import { v4 as uuid } from 'uuid';
import {
  generateWeeksByCount, addWeeks, durationWeeks,
  type Location, type Discipline, type Grade, type Team, type StageType,
  type Holiday, type Resource, type Project, type ProjectStage,
  type Allocation, type AppUser, type AppSettings, type ProjectType,
} from '@engine';
import { composeFullName } from '../lib/naming';

export interface DemoData {
  locations: Location[];
  disciplines: Discipline[];
  grades: Grade[];
  teams: Team[];
  stageTypes: StageType[];
  holidays: Holiday[];
  resources: Resource[];
  projects: Project[];
  stages: ProjectStage[];
  allocations: Allocation[];
  users: AppUser[];
  settings: AppSettings;
}

const ts = '2025-06-01T00:00:00.000Z';

export function buildDemoData(baseSettings: AppSettings): DemoData {
  // ── Locations ──
  const locations: Location[] = [
    { id: 'loc-cok', code: 'COK', name: 'Cochin, India', is_active: true },
    { id: 'loc-dxb', code: 'DXB', name: 'Dubai, UAE', is_active: true },
    { id: 'loc-sri', code: 'SRI', name: 'Sri Lanka', is_active: true },
    { id: 'loc-blr', code: 'BLR', name: 'Bangalore, India', is_active: true },
  ];
  const locByCode = Object.fromEntries(locations.map((l) => [l.code, l.id]));

  // ── Disciplines (the four real engineering disciplines) ──
  const disciplines: Discipline[] = [
    { id: 'disc-mech', name: 'Mechanical', color: 'var(--disc-mech)', sort_order: 1, is_active: true },
    { id: 'disc-elec', name: 'Electrical', color: 'var(--disc-elec)', sort_order: 2, is_active: true },
    { id: 'disc-ph', name: 'Public Health', color: 'var(--disc-plumb)', sort_order: 3, is_active: true },
    { id: 'disc-bim', name: 'BIM', color: 'var(--disc-bim)', sort_order: 4, is_active: true },
  ];

  // ── Grades ──
  const gradeNames = [
    ['Manager', null], ['Associate', null],
    ['Principal Engineer (M)', 'M'], ['Senior Engineer (M)', 'M'], ['Engineer (M)', 'M'],
    ['Principal Engineer (E)', 'E'], ['Senior Engineer (E)', 'E'], ['Engineer (E)', 'E'],
    ['Engineer PHE', 'PH'], ['Engineer (GET)', 'GET'],
  ] as const;
  const grades: Grade[] = gradeNames.map(([name, cat], i) => ({
    id: `grade-${i}`, name, discipline_category: cat, sort_order: i,
  }));
  const gradeByName = Object.fromEntries(grades.map((g) => [g.name, g.id]));

  // ── Teams ──
  const teams: Team[] = [
    { id: 'team-a', name: 'Team A', is_active: true },
    { id: 'team-b', name: 'Team B', is_active: true },
    { id: 'team-c', name: 'Team C', is_active: true },
    { id: 'team-d', name: 'Team D', is_active: true },
    { id: 'team-shared', name: 'Shared Support', is_active: true },
  ];
  const teamByName = Object.fromEntries(teams.map((t) => [t.name, t.id]));

  // ── Stage types (canonical set seeded; Admin-editable) ──
  const stageNames = ['CD', 'SD 50%', 'SD 100%', 'DD 50%', 'DD 100%', 'AOR', 'TD/IFC', 'Tender Review', 'IFC'];
  const stageTypes: StageType[] = stageNames.map((name, i) => ({
    id: `st-${i}`, name, sort_order: i, is_active: true,
  }));

  // ── Public holidays (demo; drive the pink shading) ──
  const holidays: Holiday[] = [
    { id: 'h1', location_id: null, date: '2025-12-25', name: 'Christmas Day' },
    { id: 'h2', location_id: null, date: '2026-01-01', name: 'New Year' },
    { id: 'h3', location_id: locByCode.COK, date: '2025-08-15', name: 'Independence Day (India)' },
    { id: 'h4', location_id: locByCode.DXB, date: '2025-12-02', name: 'UAE National Day' },
    { id: 'h5', location_id: locByCode.COK, date: '2025-10-02', name: 'Gandhi Jayanti' },
  ];

  // ── Resources (from the live "Staff Names" sheet, §8) ──
  // [forename, disciplineId|null, gradeName, teamName, locationCode, roleTitle?]
  const people: Array<[string, string | null, string, string, string, string?]> = [
    // Shared Support
    ['Alex', 'disc-mech', 'Principal Engineer (M)', 'Shared Support', 'DXB'],
    ['Deepak', null, 'Associate', 'Shared Support', 'DXB', 'Design Manager'],
    ['Vinod', null, 'Manager', 'Shared Support', 'COK', 'Digital Delivery'],
    // Team A — Mechanical
    ['Basheer', 'disc-mech', 'Associate', 'Team A', 'COK'],
    ['Anish K', 'disc-mech', 'Engineer (M)', 'Team A', 'COK'],
    ['Abhijith', 'disc-mech', 'Engineer (M)', 'Team A', 'COK'],
    ['Jinto', 'disc-mech', 'Senior Engineer (M)', 'Team A', 'COK'],
    ['Kaverimani R', 'disc-mech', 'Senior Engineer (M)', 'Team A', 'COK'],
    ['Aby', 'disc-mech', 'Engineer (M)', 'Team A', 'COK'],
    ['Jayakrishnan', 'disc-mech', 'Engineer (GET)', 'Team A', 'COK'],
    ['Jeevan', 'disc-mech', 'Engineer (GET)', 'Team A', 'COK'],
    ['Vijesh', 'disc-mech', 'Engineer (M)', 'Team A', 'COK'],
    ['Sharafat', 'disc-ph', 'Engineer PHE', 'Team A', 'COK'],
    ['Samjith', 'disc-ph', 'Engineer PHE', 'Team A', 'COK'],
    // Team A — Electrical
    ['Muralidharan', 'disc-elec', 'Engineer (E)', 'Team A', 'COK'],
    ['Sameer', 'disc-elec', 'Principal Engineer (E)', 'Team A', 'COK'],
    ['Ponnu', 'disc-elec', 'Senior Engineer (E)', 'Team A', 'COK'],
    ['Anusuya', 'disc-elec', 'Engineer (E)', 'Team A', 'COK'],
    ['Abu Thahir', 'disc-elec', 'Senior Engineer (E)', 'Team A', 'COK'],
    ['Gouri', 'disc-elec', 'Engineer (E)', 'Team A', 'COK'],
    ['Ajmal', 'disc-elec', 'Engineer (GET)', 'Team A', 'COK'],
    // Team A — BIM
    ['Akshay S', 'disc-bim', 'Engineer (E)', 'Team A', 'COK'],
    ['Arun P J', 'disc-bim', 'Engineer (E)', 'Team A', 'COK'],
    ['Aneesh Ayyappan', 'disc-bim', 'Engineer (E)', 'Team A', 'COK'],
    ['Bhagyaraj N G', 'disc-bim', 'Engineer (M)', 'Team A', 'COK'],
    ['Aswin', 'disc-bim', 'Engineer (M)', 'Team A', 'COK'],
    ['Sidharth', 'disc-bim', 'Engineer (M)', 'Team A', 'COK'],
    ['Arun Das', 'disc-bim', 'Engineer (M)', 'Team A', 'COK'],
    ['Ajith', 'disc-bim', 'Engineer (M)', 'Team A', 'COK'],
    ['Magesh', 'disc-bim', 'Engineer (M)', 'Team A', 'COK'],
    ['Soorej', 'disc-bim', 'Engineer (M)', 'Team A', 'COK'],
  ];

  const discNameById = Object.fromEntries(disciplines.map((d) => [d.id, d.name]));
  const resources: Resource[] = people.map(([forename, discId, gradeName, teamName, locCode, roleTitle], i) => {
    const discLabel = discId ? discNameById[discId] : roleTitle ?? null;
    return {
      id: `res-${i}`,
      forename,
      full_name: composeFullName({ team: teamName, discipline: discLabel, grade: gradeName, forename }),
      discipline_id: discId,
      grade_id: gradeByName[gradeName] ?? null,
      team_id: teamByName[teamName] ?? null,
      location_id: locByCode[locCode] ?? null,
      employment_type: 'In House',
      employee_code: `FOC-${String(i + 1).padStart(3, '0')}`,
      role_title: roleTitle ?? gradeName,
      weekly_capacity_hours: 42.5,
      status: 'Active',
      join_date: null,
      notes: null,
      created_at: ts,
      updated_at: ts,
    };
  });

  // ── Projects (§8 list — all editable/archivable) ──
  const projectSpecs = [
    '2025-P009-ENG-Sumersalt Beach Club, Bluehaus',
    '2025-P015-ENG-Anantara The Palm, DSA',
    '2025-P030-MULTI-Discovery Dunes PH1 & PH2',
    '2025-P043-MULTI-Al Moultaqa KEC',
    '2025-P045-MULTI-French Riviera Promenade',
    '2025-P047-MULTI-Seville 7BDR Villa_Bloom',
    '26001M_Discovery Condos',
    '26002M_Al Fursan',
    '26003M_Alef Waterfront',
    '26004M_Aldar MI Housing',
    '26005M_Sharjah Conv Center',
    '26006M_Nike Store MOE',
    '26007M_Sofitel Refurb',
    '26008C_BYW-School',
    '26009M_Bvlgari Resort-Lobby',
    '26010M_NAE-KODA',
    '26011C_TVS Office',
    '26012C_VVIP Centre-GHD',
  ];
  const pmNames = ['Alex', 'Deepak', 'Sameer', 'Jinto'];
  const clients = ['Bluehaus', 'DSA', 'Discovery', 'KEC', 'Aldar', 'GHD', 'TVS'];
  const projects: Project[] = projectSpecs.map((spec, i) => {
    let code = spec, name = spec, type: ProjectType | null = null;
    if (spec.includes('_')) {
      const idx = spec.indexOf('_');
      code = spec.slice(0, idx);
      name = spec.slice(idx + 1);
      const last = code.slice(-1);
      type = last === 'C' ? 'C' : last === 'M' ? 'M' : null;
    } else {
      const parts = spec.split('-');
      code = parts.slice(0, 3).join('-');
      type = (parts[2] as ProjectType) ?? null;
      name = parts.slice(3).join('-');
    }
    return {
      id: `proj-${i}`,
      code,
      name,
      client: clients[i % clients.length],
      location_id: i % 3 === 0 ? locByCode.DXB : locByCode.COK,
      project_manager: pmNames[i % pmNames.length],
      project_type: type,
      status: 'Active',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: ts,
      updated_at: ts,
    };
  });

  // ── Stages for the first few projects (relative to planner start) ──
  const start = baseSettings.planner_start;
  const stagePlan = [
    { name: 'CD', offset: 0, len: 6 },
    { name: 'SD 50%', offset: 6, len: 6 },
    { name: 'SD 100%', offset: 12, len: 8 },
    { name: 'DD 50%', offset: 20, len: 6 },
    { name: 'DD 100%', offset: 26, len: 8 },
    { name: 'IFC', offset: 34, len: 2 },
  ];
  const stageTypeByName = Object.fromEntries(stageTypes.map((s) => [s.name, s.id]));
  const stages: ProjectStage[] = [];
  const stagedProjects = projects.slice(0, 4);
  for (const p of stagedProjects) {
    stagePlan.forEach((sp, si) => {
      const sStart = addWeeks(start, sp.offset);
      const sEnd = addWeeks(start, sp.offset + sp.len - 1);
      stages.push({
        id: uuid(),
        project_id: p.id,
        stage_type_id: stageTypeByName[sp.name] ?? null,
        stage_name: sp.name,
        start_date: sStart,
        end_date: sEnd,
        duration_weeks: durationWeeks(sStart, sEnd),
        sort_order: si,
      });
    });
  }

  // ── Demo allocations (deterministic; spans the full ~2-year horizon so any
  //    default window — including "today" — shows a realistic util mix) ──
  const weeks = generateWeeksByCount(start, 104, baseSettings.week_start_day);
  const stagedIds = stagedProjects.map((p) => p.id);
  const allocations: Allocation[] = [];
  const pushAlloc = (resId: string, projId: string, weekISO: string, factor: number) => {
    allocations.push({
      id: uuid(),
      resource_id: resId,
      project_id: projId,
      stage_id: null,
      week_start_date: weekISO,
      allocation_factor: factor,
      created_by: 'demo',
      created_at: ts,
      updated_at: ts,
    });
  };

  // Five deterministic utilization profiles → primary/secondary project loads.
  // 0: 100% (green) · 1: 120% over (red) · 2: 40% under (blue) · 3: 90% (lavender) · 4: 20% gap
  const profiles: Array<{ a: number; b: number | null }> = [
    { a: 0.5, b: 0.5 },
    { a: 0.7, b: 0.5 },
    { a: 0.4, b: null },
    { a: 0.5, b: 0.4 },
    { a: 0.2, b: null },
  ];

  resources.forEach((r, i) => {
    // Skip management leads (Deepak, Vinod) from heavy loading; give Alex light oversight.
    if (i === 1 || i === 2) return;
    const profile = profiles[i % profiles.length];
    const projA = stagedIds[i % stagedIds.length];
    const projB = stagedIds[(i + 2) % stagedIds.length];
    const startW = (i * 3) % 20;
    const endW = Math.min(weeks.length - 1, startW + 64 + (i % 24));
    for (let w = startW; w <= endW; w++) {
      pushAlloc(r.id, projA, weeks[w], profile.a);
      if (profile.b != null && projB !== projA) pushAlloc(r.id, projB, weeks[w], profile.b);
    }
  });

  // ── App users (map to auth later). Staff accounts link to a resource record. ──
  const vinod = resources.find((r) => r.forename === 'Vinod');
  const abhijith = resources.find((r) => r.forename === 'Abhijith');
  const users: AppUser[] = [
    { id: 'user-master', email: 'pnfocal@gmail.com', name: 'Master Admin', role: 'master_admin', status: 'Active', resource_id: null },
    { id: 'user-admin', email: 'vinod@focalpm.com', name: 'Vinod', role: 'admin', status: 'Active', resource_id: vinod?.id ?? null },
    { id: 'user-staff', email: 'abhijith@focalpm.com', name: 'Abhijith', role: 'staff', status: 'Active', resource_id: abhijith?.id ?? null },
  ];

  return {
    locations, disciplines, grades, teams, stageTypes, holidays,
    resources, projects, stages, allocations, users,
    settings: { ...baseSettings },
  };
}

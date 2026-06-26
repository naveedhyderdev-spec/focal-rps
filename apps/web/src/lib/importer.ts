/**
 * Excel importer for the live "Focal Resource Forecast" workbook (spec §9).
 *
 * Parses the `Staff Names` sheet (people) and the `Project Resource` sheet
 * (projects → stages → resource × week allocation factors), producing a
 * dry-run preview the user reviews before committing. Commit upserts master
 * data + resources + projects + stages + allocations into the data layer.
 *
 * The Project Resource sheet is a series of blocks:
 *   [PROJECT header row with week dates in cols F+]
 *   [project-name row + first stage] [stage rows…]
 *   [Resource marker] [resource rows: full name + weekly factors]
 */
import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { durationWeeks } from '@engine';
import { provider } from '../data';
import { composeFullName } from './naming';

export interface ParsedResource {
  full_name: string;
  forename: string;
  disciplineName: string | null;
  gradeName: string | null;
  teamName: string | null;
  locationCode: string | null;
}
export interface ParsedProject { name: string; code: string }
export interface ParsedStage { projectName: string; stage_name: string; start: string; end: string }
export interface ParsedAllocation { resourceFullName: string; projectName: string; week: string; factor: number }

export interface ImportPreview {
  resources: ParsedResource[];
  projects: ParsedProject[];
  stages: ParsedStage[];
  allocations: ParsedAllocation[];
  weeks: string[];
  warnings: string[];
  counts: Record<string, number>;
}

function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function serialToISO(serial: number): string {
  // Excel epoch is 1899-12-30 (accounting for the 1900 leap-year bug).
  return toISO(new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000));
}
function cellDate(v: unknown): string | null {
  if (v instanceof Date) return toISO(v);
  if (typeof v === 'number' && v > 40_000 && v < 60_000) return serialToISO(v);
  return null;
}
const str = (v: unknown) => (v == null ? '' : String(v).trim());

/** Derive a short project code from a descriptive name, if one is embedded. */
function deriveCode(name: string): string {
  const us = name.match(/^([0-9]{4,6}[A-Z]?)[_-]/); // e.g. 26001M_…
  if (us) return us[1];
  const eng = name.match(/^(\d{4}-P\d{3}-[A-Z]+)/); // e.g. 2025-P009-ENG-…
  if (eng) return eng[1];
  return '';
}

export function parseFocalWorkbook(data: ArrayBuffer): ImportPreview {
  const wb = XLSX.read(data, { cellDates: true });
  const warnings: string[] = [];

  // ── Staff Names → resources ──
  const resources: ParsedResource[] = [];
  const staff = wb.Sheets['Staff Names'];
  if (staff) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(staff, { header: 1, blankrows: false });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const fullName = str(r[1]);
      const forename = str(r[4]);
      if (!fullName && !forename) continue;
      if (!forename) continue; // skip section separators / blanks
      resources.push({
        full_name: fullName || forename,
        forename,
        disciplineName: str(r[2]) || null,
        gradeName: str(r[3]) || null,
        teamName: str(r[5]) || null,
        locationCode: str(r[6]) || null,
      });
    }
  } else {
    warnings.push('No "Staff Names" sheet found — no people imported.');
  }

  // ── Project Resource → projects, stages, allocations ──
  const projects: ParsedProject[] = [];
  const stages: ParsedStage[] = [];
  const allocations: ParsedAllocation[] = [];
  const weekSet = new Set<string>();

  const pr = wb.Sheets['Project Resource'];
  if (pr) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(pr, { header: 1, blankrows: false });
    let weekCols: { col: number; date: string }[] = [];
    let currentProject: string | null = null;
    let mode: 'stages' | 'resources' | null = null;
    const seenProjects = new Set<string>();

    for (const r of rows) {
      const a = str(r[0]);
      if (a.toUpperCase() === 'PROJECT') {
        // header row — capture week-date columns
        weekCols = [];
        for (let c = 5; c < r.length; c++) {
          const iso = cellDate(r[c]);
          if (iso) { weekCols.push({ col: c, date: iso }); weekSet.add(iso); }
        }
        continue;
      }
      if (a.toLowerCase() === 'resource') { mode = 'resources'; continue; }

      const stage = str(r[1]);
      const startISO = cellDate(r[2]);
      const endISO = cellDate(r[3]);

      // New project: non-empty name in col A (not a keyword) + a stage with dates
      if (a && stage && startISO) {
        currentProject = a;
        if (!seenProjects.has(a)) { seenProjects.add(a); projects.push({ name: a, code: deriveCode(a) }); }
        mode = 'stages';
        if (endISO) stages.push({ projectName: a, stage_name: stage, start: startISO, end: endISO });
        continue;
      }
      // Continuation stage row (blank name)
      if (mode === 'stages' && !a && stage && startISO && endISO && currentProject) {
        stages.push({ projectName: currentProject, stage_name: stage, start: startISO, end: endISO });
        continue;
      }
      // Resource row
      if (mode === 'resources' && a && currentProject) {
        for (const wc of weekCols) {
          const v = r[wc.col];
          if (typeof v === 'number' && v > 0) {
            allocations.push({ resourceFullName: a, projectName: currentProject, week: wc.date, factor: Math.round(v * 100) / 100 });
          }
        }
      }
    }
  } else {
    warnings.push('No "Project Resource" sheet found — no projects/allocations imported.');
  }

  // ── Validation / sanity ──
  const resourceNames = new Set(resources.map((r) => r.full_name));
  const unmatched = new Set(allocations.map((a) => a.resourceFullName).filter((n) => !resourceNames.has(n)));
  if (unmatched.size) warnings.push(`${unmatched.size} allocated resource name(s) are not in Staff Names — they'll be created from the allocation rows.`);
  const overOne = allocations.filter((a) => a.factor > 2).length;
  if (overOne) warnings.push(`${overOne} allocation cell(s) exceed 200% — please verify.`);

  const weeks = [...weekSet].sort();
  return {
    resources, projects, stages, allocations, weeks, warnings,
    counts: {
      people: resources.length,
      projects: projects.length,
      stages: stages.length,
      allocations: allocations.length,
      weeks: weeks.length,
    },
  };
}

/** Commit a parsed preview: upsert master data, people, projects, stages, allocations. */
export async function commitImport(preview: ImportPreview): Promise<{ created: Record<string, number> }> {
  const [disciplines, grades, teams, locations, existingResources, existingProjects] = await Promise.all([
    provider.disciplines.list(), provider.grades.list(), provider.teams.list(),
    provider.locations.list(), provider.resources.list(), provider.projects.list(),
  ]);

  const discByName = new Map(disciplines.map((d) => [d.name.toLowerCase(), d]));
  const gradeByName = new Map(grades.map((g) => [g.name.toLowerCase(), g]));
  const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t]));
  const locByCode = new Map(locations.map((l) => [l.code.toLowerCase(), l]));
  const created = { disciplines: 0, grades: 0, teams: 0, locations: 0, resources: 0, projects: 0, stages: 0, allocations: 0 };

  const ensureDisc = async (name: string | null) => {
    if (!name) return null;
    const k = name.toLowerCase();
    if (discByName.has(k)) return discByName.get(k)!.id;
    const row = await provider.disciplines.create({ name, color: 'var(--disc-mech)', sort_order: discByName.size, is_active: true });
    discByName.set(k, row); created.disciplines++; return row.id;
  };
  const ensureGrade = async (name: string | null) => {
    if (!name) return null;
    const k = name.toLowerCase();
    if (gradeByName.has(k)) return gradeByName.get(k)!.id;
    const row = await provider.grades.create({ name, discipline_category: null, sort_order: gradeByName.size });
    gradeByName.set(k, row); created.grades++; return row.id;
  };
  const ensureTeam = async (name: string | null) => {
    if (!name) return null;
    const k = name.toLowerCase();
    if (teamByName.has(k)) return teamByName.get(k)!.id;
    const row = await provider.teams.create({ name, is_active: true });
    teamByName.set(k, row); created.teams++; return row.id;
  };
  const ensureLoc = async (code: string | null) => {
    if (!code) return null;
    const k = code.toLowerCase();
    if (locByCode.has(k)) return locByCode.get(k)!.id;
    const row = await provider.locations.create({ code, name: code, is_active: true });
    locByCode.set(k, row); created.locations++; return row.id;
  };

  // Resources (upsert by full_name)
  const resByFullName = new Map(existingResources.map((r) => [r.full_name, r]));
  for (const p of preview.resources) {
    if (resByFullName.has(p.full_name)) continue;
    const [discipline_id, grade_id, team_id, location_id] = await Promise.all([
      ensureDisc(p.disciplineName), ensureGrade(p.gradeName), ensureTeam(p.teamName), ensureLoc(p.locationCode),
    ]);
    const row = await provider.resources.create({
      forename: p.forename,
      full_name: p.full_name || composeFullName({ team: p.teamName, discipline: p.disciplineName, grade: p.gradeName, forename: p.forename }),
      discipline_id, grade_id, team_id, location_id,
      employment_type: 'In House', employee_code: null, email: null, role_title: p.gradeName,
      weekly_capacity_hours: 42.5, status: 'Active', join_date: null, notes: null,
    });
    resByFullName.set(p.full_name, row); created.resources++;
  }

  // Resources referenced only in allocations (not in Staff Names)
  for (const name of new Set(preview.allocations.map((a) => a.resourceFullName))) {
    if (resByFullName.has(name)) continue;
    const forename = name.split(' - ').pop() ?? name;
    const row = await provider.resources.create({
      forename, full_name: name, discipline_id: null, grade_id: null, team_id: null, location_id: null,
      employment_type: 'In House', employee_code: null, email: null, role_title: null, weekly_capacity_hours: 42.5,
      status: 'Active', join_date: null, notes: null,
    });
    resByFullName.set(name, row); created.resources++;
  }

  // Projects (upsert by name)
  const projByName = new Map(existingProjects.map((p) => [p.name, p]));
  for (const p of preview.projects) {
    if (projByName.has(p.name)) continue;
    const row = await provider.projects.create({
      code: p.code, name: p.name, client: null, location_id: null, project_manager: null,
      project_type: null, status: 'Active', start_date: null, end_date: null, notes: null,
    });
    projByName.set(p.name, row); created.projects++;
  }

  // Stages
  const stageTypes = await provider.stageTypes.list();
  const stByName = new Map(stageTypes.map((s) => [s.name.toLowerCase(), s]));
  let sortOrder = 0;
  for (const s of preview.stages) {
    const project = projByName.get(s.projectName);
    if (!project) continue;
    await provider.stages.create({
      project_id: project.id,
      stage_type_id: stByName.get(s.stage_name.toLowerCase())?.id ?? null,
      stage_name: s.stage_name, start_date: s.start, end_date: s.end,
      duration_weeks: durationWeeks(s.start, s.end), sort_order: sortOrder++,
    });
    created.stages++;
  }

  // Allocations
  const rows = preview.allocations.map((a) => {
    const resource = resByFullName.get(a.resourceFullName);
    const project = projByName.get(a.projectName);
    if (!resource || !project) return null;
    return {
      id: uuid(), resource_id: resource.id, project_id: project.id, stage_id: null,
      week_start_date: a.week, allocation_factor: a.factor, created_by: 'import',
    };
  }).filter(Boolean) as Parameters<typeof provider.allocations.bulkUpsert>[0];
  await provider.allocations.bulkUpsert(rows);
  created.allocations = rows.length;

  await provider.activity.log({ user_id: null, action: 'import', entity: 'system', entity_id: null, details: created });
  return { created };
}

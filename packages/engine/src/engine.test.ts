import { describe, it, expect } from 'vitest';
import {
  // dates
  startOfWeek,
  generateWeeks,
  generateWeeksByCount,
  durationWeeks,
  groupWeeksByMonth,
  weekLabelMap,
  monthLabel,
  quarterLabel,
  isWeekend,
  addWeeks,
  // capacity
  factorToHours,
  hoursToFactor,
  percentToHours,
  factorToPercent,
  DEFAULT_WEEKLY_CAPACITY,
  // bands
  classifyBand,
  DEFAULT_UTIL_THRESHOLDS,
  // utilization
  sumFactorsByWeek,
  weeklyUtilizationPercent,
  averageUtilizationPercent,
  peakUtilizationPercent,
  // demand
  buildDemandCapacity,
  // conflicts
  detectOverAllocations,
  detectResourceGaps,
  detectProjectConflicts,
} from './index.js';
import type { Allocation, Resource, Project, ProjectStage } from './index.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function alloc(resource_id: string, project_id: string, week: string, factor: number): Allocation {
  return {
    id: `${resource_id}-${project_id}-${week}`,
    resource_id,
    project_id,
    stage_id: null,
    week_start_date: week,
    allocation_factor: factor,
    created_by: null,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  };
}

function resource(id: string, over: Partial<Resource> = {}): Resource {
  return {
    id,
    forename: id,
    full_name: id,
    discipline_id: 'mech',
    grade_id: null,
    team_id: 'team-a',
    location_id: 'cok',
    employment_type: 'In House',
    employee_code: null,
    role_title: null,
    weekly_capacity_hours: 42.5,
    status: 'Active',
    join_date: null,
    notes: null,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...over,
  };
}

// ─── dates ───────────────────────────────────────────────────────────────────

describe('dates', () => {
  it('snaps to Saturday week-start (matches workbook Planner Start)', () => {
    // 2025-06-07 is a Saturday
    expect(startOfWeek('2025-06-07', 6)).toBe('2025-06-07');
    expect(startOfWeek('2025-06-10', 6)).toBe('2025-06-07'); // Tuesday → prior Saturday
    expect(startOfWeek('2025-06-13', 6)).toBe('2025-06-07'); // Friday → prior Saturday
    expect(startOfWeek('2025-06-14', 6)).toBe('2025-06-14'); // next Saturday
  });

  it('supports Monday week-start', () => {
    expect(startOfWeek('2025-06-11', 1)).toBe('2025-06-09'); // Wed → prior Monday
  });

  it('generates consecutive Saturday week buckets', () => {
    const weeks = generateWeeks('2025-06-07', '2025-07-05', 6);
    expect(weeks).toEqual([
      '2025-06-07', '2025-06-14', '2025-06-21', '2025-06-28', '2025-07-05',
    ]);
  });

  it('generates a fixed count of weeks', () => {
    expect(generateWeeksByCount('2025-06-07', 3, 6)).toEqual([
      '2025-06-07', '2025-06-14', '2025-06-21',
    ]);
  });

  it('computes inclusive stage duration in weeks', () => {
    // workbook: CD 2025-06-07 → 2025-06-... 6 weeks etc. Use a clean span.
    expect(durationWeeks('2025-06-07', '2025-06-13')).toBe(1); // 7 days
    expect(durationWeeks('2025-06-07', '2025-06-20')).toBe(2); // 14 days
    expect(durationWeeks('2025-06-07', '2025-07-18')).toBe(6); // 42 days
  });

  it('labels months and quarters', () => {
    expect(monthLabel('2025-06-07')).toBe('Jun-25');
    expect(monthLabel('2026-07-04')).toBe('Jul-26');
    expect(quarterLabel('2025-06-07')).toBe('Q2-25');
    expect(quarterLabel('2026-01-03')).toBe('Q1-26');
  });

  it('groups weeks into months and labels Jun W1, Jun W2 …', () => {
    const weeks = generateWeeks('2025-06-07', '2025-07-12', 6);
    const groups = groupWeeksByMonth(weeks);
    expect(groups.map((g) => g.label)).toEqual(['Jun-25', 'Jul-25']);
    expect(groups[0].weekLabels).toEqual(['Jun W1', 'Jun W2', 'Jun W3', 'Jun W4']);
    const map = weekLabelMap(weeks);
    expect(map.get('2025-06-07')).toBe('Jun W1');
    expect(map.get('2025-07-05')).toBe('Jul W1');
  });

  it('detects weekend days', () => {
    expect(isWeekend('2025-06-07')).toBe(true); // Saturday
    expect(isWeekend('2025-06-08')).toBe(true); // Sunday
    expect(isWeekend('2025-06-09')).toBe(false); // Monday
  });

  it('adds weeks correctly across month boundaries', () => {
    expect(addWeeks('2025-06-28', 1)).toBe('2025-07-05');
  });
});

// ─── capacity (the 42.5 rule, acceptance #2) ────────────────────────────────

describe('capacity — 42.5 rule', () => {
  it('matches the canonical factor/percent/hours table', () => {
    expect(factorToHours(1.0)).toBe(42.5);
    expect(factorToHours(0.5)).toBe(21.25);
    expect(factorToHours(0.4)).toBe(17.0);
    expect(factorToHours(0.2)).toBe(8.5);
    expect(DEFAULT_WEEKLY_CAPACITY).toBe(42.5);
  });

  it('% and hours stay in sync both directions', () => {
    expect(percentToHours(100)).toBe(42.5);
    expect(percentToHours(50)).toBe(21.25);
    expect(hoursToFactor(42.5)).toBe(1.0);
    expect(hoursToFactor(8.5)).toBeCloseTo(0.2, 10);
    expect(factorToPercent(1.2)).toBe(120); // over-allocation never clamped
  });

  it('honours a per-resource capacity override', () => {
    expect(factorToHours(1.0, 40)).toBe(40);
    expect(hoursToFactor(20, 40)).toBe(0.5);
  });
});

// ─── bands (§3.4) ────────────────────────────────────────────────────────────

describe('utilization bands', () => {
  const t = DEFAULT_UTIL_THRESHOLDS;
  it('classifies each band boundary', () => {
    expect(classifyBand(0, t)).toBe('under');
    expect(classifyBand(79, t)).toBe('under');
    expect(classifyBand(80, t)).toBe('moderate');
    expect(classifyBand(90, t)).toBe('moderate');
    expect(classifyBand(91, t)).toBe('full');
    expect(classifyBand(100, t)).toBe('full');
    expect(classifyBand(101, t)).toBe('slightOver');
    expect(classifyBand(110, t)).toBe('slightOver');
    expect(classifyBand(111, t)).toBe('over');
    expect(classifyBand(150, t)).toBe('over');
  });
});

// ─── utilization (§3.3, acceptance #3) ───────────────────────────────────────

describe('utilization — summed across projects', () => {
  const weeks = ['2025-06-07', '2025-06-14', '2025-06-21'];
  // resource R1 split across two projects in the same week → util sums
  const allocations = [
    alloc('R1', 'P1', '2025-06-07', 0.5),
    alloc('R1', 'P2', '2025-06-07', 0.7), // → 1.2 = 120% over-allocated
    alloc('R1', 'P1', '2025-06-14', 0.4),
    alloc('R1', 'P2', '2025-06-21', 0.2),
  ];

  it('sums factors per week', () => {
    const map = sumFactorsByWeek(allocations);
    expect(map.get('2025-06-07')).toBeCloseTo(1.2, 10);
    expect(map.get('2025-06-14')).toBeCloseTo(0.4, 10);
  });

  it('computes weekly utilization% as a sum across projects', () => {
    expect(weeklyUtilizationPercent(allocations, '2025-06-07')).toBeCloseTo(120, 10);
    expect(weeklyUtilizationPercent(allocations, '2025-06-14')).toBeCloseTo(40, 10);
    expect(weeklyUtilizationPercent(allocations, '2025-06-21')).toBeCloseTo(20, 10);
  });

  it('averages utilization across visible weeks (missing weeks = 0)', () => {
    const map = sumFactorsByWeek(allocations);
    // (120 + 40 + 20) / 3 = 60
    expect(averageUtilizationPercent(map, weeks)).toBeCloseTo(60, 10);
    expect(peakUtilizationPercent(map, weeks)).toBeCloseTo(120, 10);
  });
});

// ─── demand vs capacity (§3.5) ───────────────────────────────────────────────

describe('demand vs capacity', () => {
  const weeks = ['2025-06-07', '2025-06-14'];
  const resources = [
    resource('R1', { discipline_id: 'mech' }),
    resource('R2', { discipline_id: 'mech' }),
    resource('R3', { discipline_id: 'elec', status: 'Inactive' }), // excluded from capacity
  ];
  const allocations = [
    alloc('R1', 'P1', '2025-06-07', 1.0),
    alloc('R2', 'P1', '2025-06-07', 0.5),
  ];

  it('demand = Σ(factor×42.5); capacity = activeCount×42.5', () => {
    const series = buildDemandCapacity(
      resources,
      allocations,
      weeks,
      (r) => r.discipline_id,
      (id) => id,
    );
    const mech = series.find((s) => s.groupId === 'mech')!;
    // week 1: (1.0 + 0.5) × 42.5 = 63.75 demand; 2 active mech × 42.5 = 85 capacity
    expect(mech.points[0].demandHours).toBeCloseTo(63.75, 10);
    expect(mech.points[0].capacityHours).toBeCloseTo(85, 10);
    expect(mech.points[1].demandHours).toBeCloseTo(0, 10);

    const elec = series.find((s) => s.groupId === 'elec')!;
    // R3 is Inactive → 0 capacity
    expect(elec.points[0].capacityHours).toBeCloseTo(0, 10);
  });
});

// ─── conflicts (§3.6) ────────────────────────────────────────────────────────

describe('conflict detection', () => {
  const weeks = ['2025-06-07', '2025-06-14'];

  it('flags over-allocated weeks (>110%)', () => {
    const resources = [resource('R1')];
    const allocations = [
      alloc('R1', 'P1', '2025-06-07', 0.8),
      alloc('R1', 'P2', '2025-06-07', 0.5), // 1.3 → 130%
    ];
    const w = detectOverAllocations(resources, allocations, weeks);
    expect(w).toHaveLength(1);
    expect(w[0].type).toBe('over_allocated');
    expect(w[0].value).toBeCloseTo(130, 10);
  });

  it('flags Active resources below the bench threshold', () => {
    const resources = [resource('R1'), resource('R2', { status: 'Inactive' })];
    const allocations = [alloc('R1', 'P1', '2025-06-07', 0.2)]; // 20% < 50%
    const w = detectResourceGaps(resources, allocations, weeks);
    // R1 flagged; R2 inactive → not flagged
    expect(w.some((x) => x.entityId === 'R1')).toBe(true);
    expect(w.some((x) => x.entityId === 'R2')).toBe(false);
  });

  it('flags an active stage with no allocations', () => {
    const projects: Project[] = [
      {
        id: 'P1', code: 'P1', name: 'Proj', client: null, location_id: null,
        project_manager: null, project_type: null, status: 'Active',
        start_date: null, end_date: null, notes: null,
        created_at: '', updated_at: '',
      },
    ];
    const stages: ProjectStage[] = [
      {
        id: 'S1', project_id: 'P1', stage_type_id: null, stage_name: 'CD',
        start_date: '2025-06-01', end_date: '2025-06-30', duration_weeks: 4, sort_order: 0,
      },
    ];
    const w = detectProjectConflicts(projects, stages, [], '2025-06-15');
    expect(w.some((x) => x.type === 'project_conflict')).toBe(true);
  });
});

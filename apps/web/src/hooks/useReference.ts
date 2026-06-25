/**
 * Convenience hook: loads the reference/master lists and exposes both sorted
 * arrays (for dropdowns) and id→entity lookup maps (for grid joins).
 */
import { useMemo } from 'react';
import type { Discipline, Grade, Team, Location, StageType } from '@engine';
import { disciplinesH, gradesH, teamsH, locationsH, stageTypesH } from './useData';

export function useReference() {
  const disciplines = disciplinesH.useList().data ?? [];
  const grades = gradesH.useList().data ?? [];
  const teams = teamsH.useList().data ?? [];
  const locations = locationsH.useList().data ?? [];
  const stageTypes = stageTypesH.useList().data ?? [];

  return useMemo(() => {
    const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
    const sortedDisc = [...disciplines].sort((a, b) => a.sort_order - b.sort_order);
    const sortedGrades = [...grades].sort((a, b) => a.sort_order - b.sort_order);
    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    const sortedLoc = [...locations].sort((a, b) => a.code.localeCompare(b.code));
    const sortedStageTypes = [...stageTypes].sort((a, b) => a.sort_order - b.sort_order);
    return {
      disciplines: sortedDisc,
      grades: sortedGrades,
      teams: sortedTeams,
      locations: sortedLoc,
      stageTypes: sortedStageTypes,
      disciplineById: byId(disciplines) as Map<string, Discipline>,
      gradeById: byId(grades) as Map<string, Grade>,
      teamById: byId(teams) as Map<string, Team>,
      locationById: byId(locations) as Map<string, Location>,
      stageTypeById: byId(stageTypes) as Map<string, StageType>,
    };
  }, [disciplines, grades, teams, locations, stageTypes]);
}

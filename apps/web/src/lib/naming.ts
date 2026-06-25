/**
 * Compose the workbook's `full_name` label:
 *   "{Team} - {Discipline|Role} {Grade} - {Forename}"
 * e.g. "Team A - Mechanical Engineer (M) - Abhijith".
 */
export function composeFullName(parts: {
  team?: string | null;
  discipline?: string | null;
  grade?: string | null;
  forename: string;
}): string {
  const mid = [parts.discipline, parts.grade].filter(Boolean).join(' ').trim();
  const left = [parts.team, mid].filter(Boolean).join(' - ');
  return [left, parts.forename].filter(Boolean).join(' - ').replace(/\s+/g, ' ').trim();
}

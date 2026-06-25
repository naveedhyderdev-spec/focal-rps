/**
 * Excel (.xlsx) export helpers via SheetJS. V1 exports values (the free build
 * doesn't do cell fills); colour bands are conveyed by an extra band column
 * where useful. Reused by Resource Summary and the Reports page (M9).
 */
import * as XLSX from 'xlsx';

export type Cell = string | number | null;

export interface SheetSpec {
  name: string;
  aoa: Cell[][];
  colWidths?: number[];
}

export function downloadWorkbook(filename: string, sheets: SheetSpec[]): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    if (s.colWidths) ws['!cols'] = s.colWidths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

/** Build a yyyy-mm-dd stamped filename. */
export function stampedName(base: string, ext = 'xlsx'): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${ext}`;
}

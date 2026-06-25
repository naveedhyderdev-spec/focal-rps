import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  width?: string;
  th?: React.CSSProperties;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: { icon?: string; title: string; message?: string; action?: ReactNode };
}

export function DataTable<T>({
  columns, rows, getRowKey, onRowClick, initialSort, empty,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sv(a);
      const bv = sv(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    setSort((s) =>
      s?.key === col.key
        ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key: col.key, dir: 'asc' },
    );
  };

  if (rows.length === 0 && empty) {
    return <EmptyState icon={empty.icon} title={empty.title} message={empty.message} action={empty.action} />;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => {
              const isSorted = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  className={`${c.sortValue ? 'sortable' : ''}${isSorted ? ' sorted' : ''}`}
                  style={{ textAlign: c.align ?? 'left', width: c.width, ...c.th }}
                  onClick={() => toggleSort(c)}
                >
                  {c.header}
                  {c.sortValue && (
                    <i
                      className={`ti ${isSorted ? (sort!.dir === 'asc' ? 'ti-caret-up-filled' : 'ti-caret-down-filled') : 'ti-arrows-sort'}`}
                      style={{ fontSize: 12, marginLeft: 4, opacity: isSorted ? 1 : 0.4 }}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

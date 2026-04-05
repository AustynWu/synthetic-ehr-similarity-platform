// DataTable.tsx — generic data table component
//
// Renders any object array as a table.
// Used in ValidationPage (schema comparison) and SavedComparisonsPage (run list).
//
// Generic type T:
//   DataTable<T extends object> — T is determined at call time.
//   e.g. DataTable<SchemaComparisonRow> or DataTable<SavedComparison>
//   This lets one component handle different data shapes without duplication.
//   object (not Record<string, unknown>) so T just needs to be an object type.
//
// Cell render priority:
//   1. column.type === "badge" — render with StatusBadge
//   2. column.render defined   — use custom renderer
//   3. default                 — display value as a string

import StatusBadge from "./StatusBadge";
import type { DataTableProps } from "../../types/contracts";

export default function DataTable<T extends object>({
  columns,
  rows,
  emptyMessage = "No data available.",
}: DataTableProps<T>) {
  return (
    // table-wrapper enables horizontal scroll on small screens
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            // Empty state — spans all columns
            <tr>
              <td colSpan={columns.length} className="table-empty-cell">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                // Prefer id, then columnName, then index as the React key
                key={String(
                  (row as { id?: string }).id ??
                  (row as { columnName?: string }).columnName ??
                  index
                )}
              >
                {columns.map((column) => {
                  const value = row[String(column.key)];

                  // Case 1: render as a badge
                  if (column.type === "badge") {
                    return (
                      <td key={String(column.key)}>
                        <StatusBadge
                          // getTone dynamically determines the colour; falls back to "info"
                          tone={column.getTone ? column.getTone(value, row) : "info"}
                        >
                          {String(value)}
                        </StatusBadge>
                      </td>
                    );
                  }

                  // Case 2: custom render function
                  if (column.render) {
                    return <td key={String(column.key)}>{column.render(value, row)}</td>;
                  }

                  // Case 3: plain string — null/undefined becomes an empty string
                  return <td key={String(column.key)}>{String(value ?? "")}</td>;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

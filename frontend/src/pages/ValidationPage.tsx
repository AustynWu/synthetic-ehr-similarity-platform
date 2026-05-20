// ValidationPage.tsx — Step 2: validation summary
//
// Shows the structural comparison of both datasets so the user can confirm:
//   - Row and column counts match
//   - Column types are aligned
//   - High-missingness columns are flagged
//
// This is a pure display page:
//   - Reads from props only, no state mutations
//   - Two buttons: go back or proceed
//
// Guard: if validationSummary is null (user navigated here directly),
//   show EmptyState and direct them to upload first.

import PageSection from "../components/ui/PageSection";
// SummaryCard was removed — SectionCard + custom stat rows can show multiple stats in one card.
import SectionCard from "../components/ui/SectionCard";
import DataTable from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import InfoAlert from "../components/ui/InfoAlert";
import PrimaryButton from "../components/ui/PrimaryButton";
import EmptyState from "../components/ui/EmptyState";
import type { DataTableColumn, SchemaComparisonRow, SharedPageProps, StatusTone } from "../types/contracts";

export default function ValidationPage({ validationSummary, goToPage }: SharedPageProps) {
  // Guard: no validation data available
  if (!validationSummary) {
    return (
      <EmptyState
        title="No validation summary yet"
        description="Upload datasets first to review schema checks and diabetes-specific validation summaries."
        actionLabel="Go to upload"
        onAction={() => goToPage("upload")}
      />
    );
  }

  // Row count difference (used for the diff banner below the dataset cards)
  const rowDiff = validationSummary.syntheticDataset.rowCount - validationSummary.realDataset.rowCount;
  const rowDiffPct = validationSummary.realDataset.rowCount > 0
    ? (Math.abs(rowDiff) / validationSummary.realDataset.rowCount * 100).toFixed(1)
    : "0.0";
  // Colour: green <5%, yellow 5–20%, red >20%
  const rowDiffTone: StatusTone =
    Number(rowDiffPct) < 5 ? "success" : Number(rowDiffPct) < 20 ? "warning" : "danger";

  // Badge colour based on missing rate: >50% red, >20% yellow, >0% blue, 0% green
  const missTone = (v: number): StatusTone =>
    v > 50 ? "danger" : v > 20 ? "warning" : v > 0 ? "info" : "success";

  // Safe percentage helpers — guard against division by zero
  const safePct = (numerator: number, denominator: number) =>
    denominator > 0 ? ((numerator / denominator) * 100).toFixed(1) : "0.0";

  const r = validationSummary.realDataset;
  const s = validationSummary.syntheticDataset;
  const realMissingCellPct    = safePct(r.missingValueCount,  r.rowCount * r.columnCount);
  const realDuplicatePct      = safePct(r.duplicateRowCount,  r.rowCount);
  const synMissingCellPct     = safePct(s.missingValueCount,  s.rowCount * s.columnCount);
  const synDuplicatePct       = safePct(s.duplicateRowCount,  s.rowCount);

  // Sort by highest missing rate (real or synthetic) so problem columns appear first.
  const sortedSchema = [...validationSummary.schemaComparison].sort(
    (a, b) =>
      Math.max(b.realMissingRate, b.syntheticMissingRate) -
      Math.max(a.realMissingRate, a.syntheticMissingRate)
  );

  // Schema comparison table column definitions
  const columns: DataTableColumn<SchemaComparisonRow>[] = [
    {
      key: "columnName",
      label: "Column",
      render: (_v, row) => (
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {row.columnName}
          {(row.realMissingRate > 20 || row.syntheticMissingRate > 20) && (
            <StatusBadge tone="warning">High missing</StatusBadge>
          )}
        </span>
      ),
    },
    {
      // Show one type if both match; show "real → synthetic" in red if they differ
      key: "realType",
      label: "Type",
      render: (_v, row) =>
        row.realType === row.syntheticType
          ? <span>{row.realType}</span>
          : <StatusBadge tone="danger">{row.realType} → {row.syntheticType}</StatusBadge>,
    },
    {
      key: "realMissingRate",
      label: "Real Missing %",
      render: (v) => {
        const n = v as number;
        return <StatusBadge tone={missTone(n)}>{n}%</StatusBadge>;
      },
    },
    {
      key: "syntheticMissingRate",
      label: "Synthetic Missing %",
      render: (v) => {
        const n = v as number;
        return <StatusBadge tone={missTone(n)}>{n}%</StatusBadge>;
      },
    },
    {
      // Diff = absolute difference between the two missing rates.
      // Smaller is better. >5% red, >1% yellow, otherwise green.
      // key "diff" does not exist on SchemaComparisonRow — render calculates it directly from row.
      key: "diff",
      label: "Diff",
      render: (_v, row) => {
        const diff = Math.abs(row.realMissingRate - row.syntheticMissingRate);
        const tone: StatusTone = diff > 5 ? "danger" : diff > 1 ? "warning" : "success";
        return <StatusBadge tone={tone}>{diff.toFixed(1)}%</StatusBadge>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (_v, row) => {
        const map: Record<string, { tone: StatusTone; label: string }> = {
          matched:               { tone: "success", label: "Matched" },
          type_mismatch:         { tone: "danger",  label: "Type mismatch" },
          missing_in_synthetic:  { tone: "warning", label: "Missing in synthetic" },
          missing_in_real:       { tone: "warning", label: "Missing in real" },
        };
        const { tone, label } = map[row.status] ?? { tone: "info", label: row.status };
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
  ];

  return (
    <div className="page-stack">
      {/* Dataset stat cards */}
      <PageSection
        title="Validation summary"
        description="Review schema alignment and data quality before running the evaluation."
      >
        {/*
          Two-column layout: real dataset on the left, synthetic on the right.
          Allows natural side-by-side comparison.
          SectionCard (white card container) + dataset-stat-row (label left, value right).
        */}
        <div className="two-column-grid">

          {/* Left: real dataset stats */}
          <SectionCard
            title="Real Dataset"
            subtitle={validationSummary.realDataset.fileName}
          >
            <div className="dataset-stat-list">

              <div className="dataset-stat-row">
                <span>Rows</span>
                {/* toLocaleString adds thousands separators: 101766 → "101,766" */}
                <strong>{validationSummary.realDataset.rowCount.toLocaleString()}</strong>
              </div>

              <div className="dataset-stat-row">
                <span>Columns</span>
                <strong>{validationSummary.realDataset.columnCount}</strong>
              </div>

              {/* Number of columns that contain at least one empty cell */}
              <div className="dataset-stat-row">
                <span>Columns with missing values <span className="stat-label-note">(≥ 1 empty cell)</span></span>
                <strong>
                  {validationSummary.realDataset.missingColumnCount}
                  <span className="stat-sub">
                    / {validationSummary.realDataset.columnCount} columns
                  </span>
                </strong>
              </div>

              {/*
                Total empty cells across the entire dataset.
                "Missing cells" is more precise than "Missing values" to avoid confusion with column count.
                Formula: missing ÷ (rows × columns) × 100
              */}
              <div className="dataset-stat-row">
                <span>Missing cells</span>
                <strong>
                  {r.missingValueCount.toLocaleString()}
                  <span className="stat-sub">
                    ({realMissingCellPct}% of all cells)
                  </span>
                </strong>
              </div>

              {/* Duplicate rows + percentage of total rows */}
              <div className="dataset-stat-row">
                <span>Duplicate rows</span>
                <strong>
                  {r.duplicateRowCount}
                  <span className="stat-sub">
                    ({realDuplicatePct}% of rows)
                  </span>
                </strong>
              </div>

            </div>
          </SectionCard>

          {/* Right: synthetic dataset stats — same structure, different data source */}
          <SectionCard
            title="Synthetic Dataset"
            subtitle={validationSummary.syntheticDataset.fileName}
          >
            <div className="dataset-stat-list">

              <div className="dataset-stat-row">
                <span>Rows</span>
                <strong>{validationSummary.syntheticDataset.rowCount.toLocaleString()}</strong>
              </div>

              <div className="dataset-stat-row">
                <span>Columns</span>
                <strong>{validationSummary.syntheticDataset.columnCount}</strong>
              </div>

              <div className="dataset-stat-row">
                <span>Columns with missing values <span className="stat-label-note">(≥ 1 empty cell)</span></span>
                <strong>
                  {validationSummary.syntheticDataset.missingColumnCount}
                  <span className="stat-sub">
                    / {validationSummary.syntheticDataset.columnCount} columns
                  </span>
                </strong>
              </div>

              <div className="dataset-stat-row">
                <span>Missing cells</span>
                <strong>
                  {s.missingValueCount.toLocaleString()}
                  <span className="stat-sub">
                    ({synMissingCellPct}% of all cells)
                  </span>
                </strong>
              </div>

              <div className="dataset-stat-row">
                <span>Duplicate rows</span>
                <strong>
                  {s.duplicateRowCount}
                  <span className="stat-sub">
                    ({synDuplicatePct}% of rows)
                  </span>
                </strong>
              </div>

            </div>
          </SectionCard>

        </div>

        {/* Row count diff banner — colour reflects severity (green <5% / yellow 5-20% / red >20%) */}
        <div className={`row-count-diff row-count-diff--${rowDiffTone}`}>
          {rowDiff === 0
            ? "Row counts match exactly between both datasets."
            : `Synthetic has ${Math.abs(rowDiff).toLocaleString()} ${rowDiff > 0 ? "more" : "fewer"} rows than Real (${rowDiffPct}% difference).`}
        </div>

        {/* Missing cell rate comparison banner — shows real vs synthetic side by side */}
        {(() => {
          const diff = Math.abs(Number(realMissingCellPct) - Number(synMissingCellPct));
          const tone: StatusTone = diff < 1 ? "success" : diff < 5 ? "warning" : "danger";
          return (
            <div className={`row-count-diff row-count-diff--${tone}`}>
              {`Missing cell rate — Real: ${realMissingCellPct}%  vs  Synthetic: ${synMissingCellPct}%  (${diff.toFixed(1)}% difference)`}
            </div>
          );
        })()}
      </PageSection>

      {/* Schema comparison table — full width */}
      <SectionCard
        title="Schema comparison"
        subtitle="Columns with highest missingness shown first. Type mismatches and large Diff values need attention before proceeding."
      >
        <DataTable<SchemaComparisonRow>
          columns={columns}
          rows={sortedSchema}
        />
      </SectionCard>

      {/* Validation findings — moved below the table so warnings are easy to spot */}
      <InfoAlert title="Validation findings" items={validationSummary.issues} />

      {/* Page footer actions */}
      <div className="page-actions">
        <PrimaryButton variant="ghost" onClick={() => goToPage("upload")}>
          Back to Upload
        </PrimaryButton>
        <PrimaryButton
          onClick={() => goToPage("setup")}
          disabled={!validationSummary.canProceed}
        >
          Proceed to Evaluation Setup
        </PrimaryButton>
      </div>
    </div>
  );
}
